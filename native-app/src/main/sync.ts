import { app, BrowserWindow } from 'electron';
import * as crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { IPC } from '../shared/ipc';
import { SyncFileEntry, SyncStatus } from '../shared/sync';
import * as fsService from './fsService';
import { getVaultName } from './vault';

function loadEnvFile(): void {
  const candidates = [
    path.join(app.getAppPath(), '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
  }
}

loadEnvFile();

const DEFAULT_API_URL = process.env.SHIPI_API_URL ?? 'http://localhost:3001';

interface PersistedState {
  apiUrl: string;
  token: string | null;
  email: string | null;
  vaultId: string | null;
  vaultKeyB64: string | null;
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
  apiUrl: DEFAULT_API_URL,
  token: null,
  email: null,
  vaultId: null,
  vaultKeyB64: null,
  lastSyncedAt: null,
  files: {},
};

let state: PersistedState = { ...EMPTY_STATE };
let inFlight: Promise<SyncStatus> | null = null;

function stateFilePath(): string {
  return path.join(app.getPath('userData'), 'sync-state.json');
}

function loadState(): void {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    state = { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    state = { ...EMPTY_STATE };
  }
  if (process.env.SHIPI_API_URL) {
    state.apiUrl = process.env.SHIPI_API_URL;
  }
}

function saveState(): void {
  fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
  fs.writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf8');
}

function getStatus(message: string | null = null): SyncStatus {
  return {
    signedIn: Boolean(state.token),
    email: state.email,
    vaultId: state.vaultId,
    lastSyncedAt: state.lastSyncedAt,
    syncing: inFlight !== null,
    message,
  };
}

function emitStatus(message: string | null = null): void {
  const snapshot = getStatus(message);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.syncStateChange, snapshot);
  }
}

function requireVault(): string {
  if (!state.token) {
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
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (res.status === 401 && state.token) {
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

/* ── Crypto ─────────────────────────────────────────────── */

function generateVaultKey(): Buffer {
  return crypto.randomBytes(32);
}

function getVaultKey(): Buffer {
  if (!state.vaultKeyB64) {
    state.vaultKeyB64 = generateVaultKey().toString('base64');
    saveState();
  }
  return Buffer.from(state.vaultKeyB64, 'base64');
}

function keyFingerprint(key: Buffer): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

interface Envelope {
  iv: string;
  authTag: string;
  data: string;
}

function encrypt(key: Buffer, plaintext: string): Envelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decrypt(key: Buffer, envelope: Envelope): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/* ── Local files ────────────────────────────────────────── */

function listLocalMarkdown(): { relPath: string }[] {
  const walk = (nodes: import('../shared/ipc').FileNode[]): { relPath: string }[] => {
    const out: { relPath: string }[] = [];
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
  return walk(fsService.buildTree());
}

function fileExists(relPath: string): boolean {
  try {
    fsService.readFile(relPath);
    return true;
  } catch {
    return false;
  }
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
  const conflictPath = fsService.createFile(dir, `${stem}-conflict-${timestamp()}.md`);
  fsService.writeFile(conflictPath, content);
  return conflictPath;
}

/* ── Auth ───────────────────────────────────────────────── */

async function authenticate(kind: 'register' | 'login', email: string, password: string): Promise<SyncStatus> {
  const res = (await api(`/auth/${kind}`, {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  })) as { accessToken: string; user: { email: string } };
  state.token = res.accessToken;
  state.email = res.user.email;
  if (!state.vaultKeyB64) {
    state.vaultKeyB64 = generateVaultKey().toString('base64');
  }
  await ensureRemoteVault();
  saveState();
  emitStatus(`Signed in as ${res.user.email}`);
  return getStatus(`Signed in as ${res.user.email}`);
}

async function ensureRemoteVault(): Promise<void> {
  const key = getVaultKey();
  const fingerprint = keyFingerprint(key);

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

async function signOutInternal(message = 'Signed out'): Promise<void> {
  state.token = null;
  state.email = null;
  state.vaultId = null;
  state.files = {};
  state.lastSyncedAt = null;
  saveState();
  emitStatus(message);
}

/* ── Google sign-in ──────────────────────────────────────── */

const GOOGLE_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

function googleAuthFlow(): Promise<SyncStatus> {
  return new Promise<SyncStatus>((resolve) => {
    let win: BrowserWindow | null = null;
    let server: http.Server | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (server) {
        server.close();
      }
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    };

    const finish = (message: string): void => {
      emitStatus(message);
      resolve(getStatus(message));
    };

    const complete = async (url: URL): Promise<void> => {
      cleanup();
      const error = url.searchParams.get('error');
      if (error) {
        throw new ApiError(`Google sign-in failed: ${error}`, 400);
      }
      const token = url.searchParams.get('token');
      const email = url.searchParams.get('email');
      if (!token || !email) {
        throw new ApiError('Google sign-in did not return a token', 400);
      }
      state.token = token;
      state.email = email;
      if (!state.vaultKeyB64) {
        state.vaultKeyB64 = generateVaultKey().toString('base64');
      }
      await ensureRemoteVault();
      saveState();
      finish(`Signed in as ${email}`);
    };

    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/shipi-callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<html><body style="font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#555">You can close this window and return to Shipi.</body></html>',
      );
      complete(url).catch((e: unknown) => {
        const message =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Google sign-in failed';
        saveState();
        finish(message);
      });
    });

    timer = setTimeout(() => {
      cleanup();
      finish('Google sign-in timed out');
    }, GOOGLE_AUTH_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', () => {
      const address = server?.address();
      if (address === null || typeof address === 'string') {
        cleanup();
        finish('Could not start the local callback server');
        return;
      }
      const redirectUri = `http://127.0.0.1:${address.port}/shipi-callback`;
      const startUrl = `${state.apiUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;

      win = new BrowserWindow({
        width: 520,
        height: 660,
        resizable: true,
        title: 'Sign in with Google',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      win.on('closed', () => {
        if (!settled) {
          cleanup();
          finish('Google sign-in cancelled');
        }
      });
      win.loadURL(startUrl).catch(() => {
        if (!settled) {
          cleanup();
          finish('Could not reach the Shipi backend');
        }
      });
    });
  });
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
    const content = fsService.readFile(file.relPath);
    const localSha = sha256(content);
    const entry = state.files[file.relPath];
    if (entry && entry.localSha256 === localSha) {
      continue;
    }

    const envelope = encrypt(getVaultKey(), content);
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
  saveState();
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
  const remoteContent = decrypt(getVaultKey(), remote.version);
  const conflictPath = writeConflictCopy(relPath, localContent);
  fsService.writeFile(relPath, remoteContent);
  state.files[relPath] = {
    serverId: entry.serverId,
    versionNo: remote.version.versionNo,
    localSha256: sha256(remoteContent),
  };
  emitStatus(`Conflict resolved — saved local copy as ${conflictPath}`);
}

async function pull(): Promise<void> {
  const vaultId = requireVault();
  const serverFiles = (await api(`/vaults/${vaultId}/files`)) as FileDto[];

  for (const serverFile of serverFiles) {
    const entry = state.files[serverFile.path];
    const localExists = fileExists(serverFile.path);
    const localContent = localExists ? fsService.readFile(serverFile.path) : null;
    const localSha = localContent ? sha256(localContent) : null;
    const localModified = Boolean(entry && localContent && entry.localSha256 !== localSha);

    if (localModified) {
      const remote = (await api(`/vaults/${vaultId}/files/${serverFile.id}`)) as VersionEnvelope;
      const remoteContent = decrypt(getVaultKey(), remote.version);
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
    const remoteContent = decrypt(getVaultKey(), remote.version);
    fsService.writeFile(serverFile.path, remoteContent);
    state.files[serverFile.path] = {
      serverId: serverFile.id,
      versionNo: remote.version.versionNo,
      localSha256: sha256(remoteContent),
    };
  }

  state.lastSyncedAt = new Date().toISOString();
  saveState();
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
      saveState();
      emitStatus(message);
      return getStatus(message);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/* ── Public API ─────────────────────────────────────────── */

export function initSync(): SyncStatus {
  loadState();
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
  return runSynchronized(() => googleAuthFlow());
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
