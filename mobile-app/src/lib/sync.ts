import { API_URL, SYNC_STATE_FILE, SYNC_TOKEN_KEY, SYNC_VAULT_KEY_KEY } from './config';
import {
  bytesToBase64,
  decryptText,
  encryptText,
  generateVaultKey,
  keyFingerprint,
  sha256Text,
} from './crypto';
import { secureDelete, secureGet, secureSet, readStateFile, writeStateFile } from './storage';
import type { SyncFileEntry, SyncStatus } from './types';
import { buildTree, createFile, fileExists, getVaultName, readFile, writeFile } from './vault';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

interface PersistedState {
  apiUrl: string;
  email: string | null;
  vaultId: string | null;
  lastSyncedAt: string | null;
  files: Record<string, SyncFileEntry>;
}

interface VaultDto {
  id: string;
  name: string;
  keyFingerprint: string;
}

interface FileDto {
  id: string;
  path: string;
  currentVersionNo: number;
}

interface VersionEnvelope {
  file: FileDto;
  version: {
    versionNo: number;
    iv: string;
    authTag: string;
    data: string;
    createdAt: string;
  };
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const EMPTY_STATE: PersistedState = {
  apiUrl: API_URL,
  email: null,
  vaultId: null,
  lastSyncedAt: null,
  files: {},
};

let state: PersistedState = { ...EMPTY_STATE };
let token: string | null = null;
let vaultKeyB64: string | null = null;
let inFlight: Promise<SyncStatus> | null = null;

type Listener = (status: SyncStatus) => void;
const listeners = new Set<Listener>();

function getStatus(message: string | null = null): SyncStatus {
  return {
    signedIn: Boolean(token),
    email: state.email,
    vaultId: state.vaultId,
    lastSyncedAt: state.lastSyncedAt,
    syncing: inFlight !== null,
    message,
  };
}

function emitStatus(message: string | null = null): void {
  const snapshot = getStatus(message);
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function requireVault(): string {
  if (!token) {
    throw new ApiError('Not signed in', 401);
  }
  if (!state.vaultId) {
    throw new ApiError('No remote vault linked', 500);
  }
  return state.vaultId;
}

async function api(
  pathname: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const res = await fetch(state.apiUrl + pathname, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (res.status === 401 && token) {
    await signOutInternal('Session expired — sign in again');
  }

  const data: { message?: string | string[] } | null =
    res.status === 204 ? null : await res.json().catch((): null => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join('; ')
      : data?.message ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

/* ── Persistence ────────────────────────────────────────── */

async function saveState(): Promise<void> {
  await writeStateFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
  if (token !== null) {
    await secureSet(SYNC_TOKEN_KEY, token);
  } else {
    await secureDelete(SYNC_TOKEN_KEY);
  }
  if (vaultKeyB64 !== null) {
    await secureSet(SYNC_VAULT_KEY_KEY, vaultKeyB64);
  }
}

async function loadState(): Promise<void> {
  const raw = await readStateFile(SYNC_STATE_FILE);
  try {
    state = raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : { ...EMPTY_STATE };
  } catch {
    state = { ...EMPTY_STATE };
  }
  token = await secureGet(SYNC_TOKEN_KEY);
  vaultKeyB64 = await secureGet(SYNC_VAULT_KEY_KEY);
}

/* ── Crypto ─────────────────────────────────────────────── */

function getVaultKey(): Uint8Array {
  if (!vaultKeyB64) {
    vaultKeyB64 = bytesToBase64(generateVaultKey());
  }
  const binary = atob(vaultKeyB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* ── Local files ────────────────────────────────────────── */

interface LocalFile {
  relPath: string;
}

function listLocalMarkdown(): LocalFile[] {
  const walk = (nodes: import('./types').FileNode[]): LocalFile[] => {
    const out: LocalFile[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        if (node.relPath.toLowerCase().endsWith('.md')) {
          out.push({ relPath: node.relPath });
        }
      } else if (node.children) {
        out.push(...walk(node.children));
      }
    }
    return out;
  };
  return walk(buildTree());
}

function splitPath(relPath: string): { dir: string | null; base: string } {
  const slash = relPath.lastIndexOf('/');
  if (slash === -1) {
    return { dir: null, base: relPath };
  }
  return { dir: relPath.slice(0, slash), base: relPath.slice(slash + 1) };
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function writeConflictCopy(relPath: string, content: string): string {
  const { dir, base } = splitPath(relPath);
  const stem = base.toLowerCase().endsWith('.md') ? base.slice(0, -3) : base;
  const conflictPath = createFile(dir, `${stem}-conflict-${timestamp()}.md`);
  writeFile(conflictPath, content);
  return conflictPath;
}

/* ── Auth ───────────────────────────────────────────────── */

async function ensureRemoteVault(): Promise<void> {
  const fingerprint = await keyFingerprint(getVaultKey());

  if (state.vaultId) {
    try {
      await api(`/vaults/${state.vaultId}`);
      return;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        state.vaultId = null;
      } else {
        throw e;
      }
    }
  }

  const vaults = (await api('/vaults')) as VaultDto[];
  const match = vaults.find((v: VaultDto) => v.keyFingerprint === fingerprint);
  if (match) {
    state.vaultId = match.id;
    return;
  }

  const created = (await api('/vaults', {
    method: 'POST',
    body: { name: getVaultName(), keyFingerprint: fingerprint },
  })) as VaultDto;
  state.vaultId = created.id;
}

async function authenticate(
  kind: 'register' | 'login',
  email: string,
  password: string,
): Promise<SyncStatus> {
  const res = (await api(`/auth/${kind}`, {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  })) as { accessToken: string; user: { email: string } };
  token = res.accessToken;
  state.email = res.user.email;
  if (!vaultKeyB64) {
    vaultKeyB64 = bytesToBase64(generateVaultKey());
  }
  await ensureRemoteVault();
  await saveState();
  emitStatus(`Signed in as ${res.user.email}`);
  return getStatus(`Signed in as ${res.user.email}`);
}

async function signOutInternal(message = 'Signed out'): Promise<void> {
  token = null;
  state.email = null;
  state.vaultId = null;
  state.files = {};
  state.lastSyncedAt = null;
  await saveState();
  emitStatus(message);
}

/* ── Google sign-in ─────────────────────────────────────── */

function parseQuery(url: string): Record<string, string> {
  const start = url.indexOf('?');
  if (start === -1) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const pair of url.slice(start + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      continue;
    }
    out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(
      pair.slice(eq + 1),
    );
  }
  return out;
}

async function signInWithGoogle(): Promise<SyncStatus> {
  const redirectUri = Linking.createURL('auth');
  const authUrl = `${state.apiUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;

  let result;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  } catch (e) {
    return getStatus(e instanceof Error ? e.message : 'Google sign-in failed');
  }

  if (result.type !== 'success' || !result.url) {
    return getStatus('Google sign-in cancelled');
  }

  const params = parseQuery(result.url);
  if (params.error) {
    return getStatus(`Google sign-in failed: ${params.error}`);
  }
  if (!params.token || !params.email) {
    return getStatus('Google sign-in did not return a token');
  }

  token = params.token;
  state.email = params.email;
  if (!vaultKeyB64) {
    vaultKeyB64 = bytesToBase64(generateVaultKey());
  }
  await ensureRemoteVault();
  await saveState();
  emitStatus(`Signed in as ${params.email}`);
  return getStatus(`Signed in as ${params.email}`);
}

/* ── Push / Pull ────────────────────────────────────────── */

async function pushOnly(): Promise<SyncStatus> {
  const vaultId = requireVault();

  const localFiles = listLocalMarkdown();
  const localPaths = new Set(localFiles.map((f) => f.relPath));

  let deleted = 0;
  for (const relPath of Object.keys(state.files)) {
    if (localPaths.has(relPath)) {
      continue;
    }
    const entry = state.files[relPath];
    try {
      await api(`/vaults/${vaultId}/files/${entry.serverId}`, { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        throw e;
      }
    }
    delete state.files[relPath];
    deleted += 1;
  }

  let pushed = 0;
  for (const file of localFiles) {
    const content = await readFile(file.relPath);
    const localSha = await sha256Text(content);
    const entry = state.files[file.relPath];
    if (entry && entry.localSha256 === localSha) {
      continue;
    }

    const envelope = await encryptText(getVaultKey(), content);
    try {
      const env = (await api(`/vaults/${vaultId}/files`, {
        method: 'PUT',
        body: {
          path: file.relPath,
          ...envelope,
          baseVersion: entry ? entry.versionNo : 0,
        },
      })) as VersionEnvelope;
      state.files[file.relPath] = {
        serverId: env.file.id,
        versionNo: env.version.versionNo,
        localSha256: localSha,
      };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && entry) {
        await resolvePushConflict(vaultId, file.relPath, entry, content);
      } else {
        throw e;
      }
    }
    pushed += 1;
  }

  state.lastSyncedAt = new Date().toISOString();
  await saveState();
  const parts = [];
  if (pushed) parts.push(`Pushed ${pushed} file${pushed === 1 ? '' : 's'}`);
  if (deleted) parts.push(`Deleted ${deleted} remote file${deleted === 1 ? '' : 's'}`);
  emitStatus(parts.join(', ') || 'Up to date');
  return getStatus(parts.join(', ') || 'Up to date');
}

async function resolvePushConflict(
  vaultId: string,
  relPath: string,
  entry: SyncFileEntry,
  localContent: string,
): Promise<void> {
  const remote = (await api(`/vaults/${vaultId}/files/${entry.serverId}`)) as VersionEnvelope;
  const remoteContent = await decryptText(getVaultKey(), remote.version);
  const conflictPath = writeConflictCopy(relPath, localContent);
  await writeFile(relPath, remoteContent);
  state.files[relPath] = {
    serverId: entry.serverId,
    versionNo: remote.version.versionNo,
    localSha256: await sha256Text(remoteContent),
  };
  emitStatus(`Conflict resolved — saved local copy as ${conflictPath}`);
}

async function pull(): Promise<void> {
  const vaultId = requireVault();
  const serverFiles = (await api(`/vaults/${vaultId}/files`)) as FileDto[];

  for (const serverFile of serverFiles) {
    const entry = state.files[serverFile.path];
    const localExists = await fileExists(serverFile.path);
    const localContent = localExists ? await readFile(serverFile.path) : null;
    const localSha = localContent ? await sha256Text(localContent) : null;
    const localModified = Boolean(entry && localContent && entry.localSha256 !== localSha);

    if (localModified) {
      const remote = (await api(`/vaults/${vaultId}/files/${serverFile.id}`)) as VersionEnvelope;
      const remoteContent = await decryptText(getVaultKey(), remote.version);
      const conflictPath = writeConflictCopy(serverFile.path, remoteContent);
      state.files[serverFile.path] = {
        serverId: serverFile.id,
        versionNo: remote.version.versionNo,
        localSha256: localSha as string,
      };
      emitStatus(`Conflict — remote copy saved as ${conflictPath}`);
      continue;
    }

    const needRemote =
      !localContent ||
      (entry !== undefined && serverFile.currentVersionNo > entry.versionNo) ||
      (entry === undefined && localExists);

    if (!needRemote) {
      continue;
    }

    const remote = (await api(`/vaults/${vaultId}/files/${serverFile.id}`)) as VersionEnvelope;
    const remoteContent = await decryptText(getVaultKey(), remote.version);
    await writeFile(serverFile.path, remoteContent);
    state.files[serverFile.path] = {
      serverId: serverFile.id,
      versionNo: remote.version.versionNo,
      localSha256: await sha256Text(remoteContent),
    };
  }

  state.lastSyncedAt = new Date().toISOString();
  await saveState();
  emitStatus('Synced');
}

async function fullSync(): Promise<SyncStatus> {
  await pull();
  await pushOnly();
  return getStatus('Synced');
}

function runSynchronized(fn: () => Promise<SyncStatus>): Promise<SyncStatus> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = (async () => {
    emitStatus('Syncing...');
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await saveState();
      emitStatus(message);
      return getStatus(message);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/* ── Public API ─────────────────────────────────────────── */

export async function initSync(): Promise<SyncStatus> {
  await loadState();
  return getStatus();
}

export function getSyncStatus(): SyncStatus {
  return getStatus();
}

export function syncSignUp(email: string, password: string): Promise<SyncStatus> {
  return runSynchronized(() => authenticate('register', email, password));
}

export function syncSignIn(email: string, password: string): Promise<SyncStatus> {
  return runSynchronized(() => authenticate('login', email, password));
}

export function syncGoogleSignIn(): Promise<SyncStatus> {
  return runSynchronized(() => signInWithGoogle());
}

export function syncSignOut(): Promise<SyncStatus> {
  return runSynchronized(async () => {
    await signOutInternal();
    return getStatus('Signed out');
  });
}

export function syncNow(): Promise<SyncStatus> {
  return runSynchronized(() => fullSync());
}

export function syncPush(): Promise<SyncStatus> {
  return runSynchronized(() => pushOnly());
}

export function onSyncStateChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
