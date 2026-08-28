# Shipi — Electron App Handoff

This document is the contract the Electron app codes against. The backend (`shipi-backend`, NestJS + Postgres) is a **zero-knowledge** sync server: it stores encrypted blobs and metadata, and it can never read note content. Every security guarantee below lives or dies on the client doing its part correctly — read **Key management** and **Encryption contract** before writing any sync code.

---

## 1. Overview

```
Electron app (this side)                    shipi-backend
─────────────────────────────────────────────────────────
1. Generate Vault Master Key (VMK)      │
2. Encrypt note: AES-256-GCM(VMK, note) │   stores: iv, authTag, data (ciphertext)
3. Upload ciphertext                    │           + path, byteLength, sha256
4. Key fingerprint (SHA-256 of VMK)     │   stores: keyFingerprint
```

- **Server stores:** ciphertext blobs, file paths, sizes, SHA-256, timestamps, version history.
- **Server never sees:** plaintext note content, the VMK, passwords (only bcrypt hashes).
- **If you lose the VMK, the vault is unrecoverable.** There is no server-side key escrow, by design.

---

## 2. Quick start

| Item | Value |
|---|---|
| Base URL | `http://localhost:3001` (dev — **3000 is taken by the electron-forge webpack dev server**; run backend as `PORT=3001 npm run start:dev`) / your deployed HTTPS URL |
| Auth | `Authorization: Bearer <accessToken>` |
| Content type | `application/json` |
| Encrypted file fields | base64 strings |

Every route below (except `/auth/*`) requires the bearer token. Requests without a valid token return `401`.

---

## 3. Auth flow

### Endpoints

```
POST /auth/register          { "email": "user@example.com", "password": "hunter2hunter2" }
POST /auth/login             { "email": "user@example.com", "password": "hunter2hunter2" }
GET  /auth/me                (auth required) -> { "id", "email" }
GET  /auth/google            browser redirect flow -> lands on redirect_uri with ?token&email
GET  /auth/google/callback   never called by the client directly (Google → backend)
```

Response (register, login and the Google flow):

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

### Google sign-in (`GET /auth/google`)

The backend owns the Google OAuth client (secret never leaves the server). The client just opens **its own** `redirect_uri` → backend flow:

1. Client opens `<base>/auth/google?redirect_uri=<urlencoded uri>` in a browser tab/webview.
   `redirect_uri` must be in the server's `APP_REDIRECT_URIS` allowlist (exact match), or a `127.0.0.1`/`localhost` loopback URI with a port when `GOOGLE_ALLOW_LOOPBACK=true` (dev only — used by the Electron app's in-process callback server).
2. Backend validates the URI, signs a short-lived **state** JWT (with a PKCE verifier), and 302s to Google.
3. Google → `GET /auth/google/callback?code&state`. Backend exchanges the code (server-side client secret), verifies the ID token against `https://oauth2.googleapis.com/tokeninfo`, find-or-creates a user by email, and issues the same Shipi JWT.
4. Backend 302s to the client's `redirect_uri` as:
   `redirect_uri?token=<accessToken>&email=<email>`
   On failure: `redirect_uri?error=<message>`.

**Client rules for Google**

- **Electron app:** spins up a loopback server on `127.0.0.1` (ephemeral port) as the `redirect_uri`, opens a modal `BrowserWindow` at the `/auth/google` URL, and reads `token`/`email`/`error` off the callback. No protocol registration needed.
- **Mobile app:** `WebBrowser.openAuthSessionAsync(base + /auth/google?redirect_uri=..., Linking.createURL('auth'))`, then parses `token`/`email`/`error` from the returned URL.
- **Web (mobile app):** `Linking.createURL('auth')` resolves to `<origin>/auth`; add that origin to `APP_REDIRECT_URIS`.
- Same email = same account: a password-created account is **linked** when the same email signs in via Google (both methods work afterwards). A Google-only account has no password; `POST /auth/login` and `/auth/register` respond with a hint to use Google instead.
- Google redirect URIs in the mobile app use the app scheme (`shipi://auth`) — the scheme is set in `app.json` (`expo.scheme`).

### Server env for Google

```
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
SHIPI_PUBLIC_URL=http://localhost:3001            # used to build the callback if unset
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback   # also register this in the Google Console
APP_REDIRECT_URIS=shipi://auth,http://localhost:8081/auth
GOOGLE_ALLOW_LOOPBACK=true                        # FALSE in production
```

### Client rules

- **Password rules:** min 8 characters (server enforces).
- **Store the token** in Electron `safeStorage` (OS keychain), not plaintext localStorage.
- **Token expiry:** default 7 days. There are **no refresh tokens** in the MVP. On any `401` during sync, drop the token, prompt re-login, then resume sync.
- **Register vs login:** register throws `401` if the email already exists — treat that as "go to login."

---

## 4. Key management (critical)

### 4.1 Generate the VMK once per vault

The VMK is a random 32-byte key. It encrypts every note in its vault. Use `crypto.randomBytes(32)`.

```ts
// electron/main/keyring.ts
import { randomBytes, createHash } from 'node:crypto';

export function createVaultKey(): { key: Buffer; fingerprint: string } {
  const key = randomBytes(32);
  return { key, fingerprint: vaultKeyFingerprint(key) };
}

export function vaultKeyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex'); // 64 hex chars
}
```

### 4.2 Show it once, let them download it

On vault creation:

1. Generate the key.
2. Show it to the user **once**, on a "Save your recovery key" screen — e.g. base64 of the raw bytes grouped into chunks.
3. Offer **Download .key file** with this exact JSON format:

```json
{
  "vaultId": "<uuid from POST /vaults>",
  "version": 1,
  "key": "<base64 of the 32-byte VMK>",
  "createdAt": "2026-08-06T10:00:00.000Z"
}
```

4. Send `{ name, keyFingerprint }` to `POST /vaults` (see API reference). The server stores only the fingerprint.

### 4.3 Verify a re-downloaded key

When the user re-imports a `.key` file, recompute `SHA-256(key)` and compare to the vault's `keyFingerprint` from `GET /vaults`. Mismatch ⇒ wrong file, reject.

### 4.4 Store the key

- Store the VMK in `safeStorage` (encrypted at rest by the OS).
- Never log it, never send it, never include it in sync payloads.

> **UX requirement:** if the key is missing on a device and no `.key` file exists, tell the user plainly that the vault **cannot be decrypted** and is unrecoverable. Do not offer a "reset password" path that implies recovery.

---

## 5. Encryption contract

Every note file becomes a **ciphertext envelope**:

```
data     = AES-256-GCM(VMK, iv, plaintext)           (ciphertext)
iv       = 12 random bytes                            -> base64
authTag  = GCM authentication tag (16 bytes)          -> base64
```

- Cipher: `aes-256-gcm`
- IV: 12 bytes, **random per file** (never reuse an IV with the same key)
- Tag: 16 bytes
- All three transported as **base64 strings** (`+`/`/` allowed, no padding on iv/tag)
- `data` is base64 ciphertext (padding allowed)

### Working Node code (put this in the Electron main process)

```ts
// electron/main/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface Envelope {
  iv: string;       // base64, 12 bytes
  authTag: string;  // base64, 16 bytes
  data: string;     // base64 ciphertext
}

export function encryptNote(key: Buffer, plaintext: string | Buffer): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

/** Throws on tamper (bad auth tag). Never swallow this. */
export function decryptNote(key: Buffer, env: Envelope): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(env.data, 'base64')),
    decipher.final(), // throws ERR_OSSL_WRONG_FINAL_BLOCK_LENGTH on tamper
  ]);
}
```

### Client-side verification

```ts
import { createHash } from 'node:crypto';
import { decryptNote } from './crypto';

export function verifyDownloadedBlob(key: Buffer, envelope: Envelope, expectedSha256: string): boolean {
  try {
    const plaintext = decryptNote(key, envelope);          // integrity check via GCM
    const sha = createHash('sha256').update(Buffer.from(envelope.data, 'base64')).digest('hex');
    return sha === expectedSha256;                          // server-recorded digest
  } catch {
    return false; // tampered or wrong key
  }
}
```

---

## 6. Full API reference

All routes use `Authorization: Bearer <token>` unless noted. Base path prefix: none (routes are root-level).

### 6.1 Auth

| Method | Path | Body | Success |
|---|---|---|---|
| `POST` | `/auth/register` | `{ email, password }` | `201 { accessToken, user }` |
| `POST` | `/auth/login` | `{ email, password }` | `201 { accessToken, user }` |
| `GET` | `/auth/google` | `?redirect_uri=` | `302 → Google` |
| `GET` | `/auth/google/callback` | – | `302 → redirect_uri?token&email` |
| `GET` | `/auth/me` | – | `200 { id, email }` |

### 6.2 Vaults

| Method | Path | Body | Success |
|---|---|---|---|
| `POST` | `/vaults` | `{ name, keyFingerprint }` | `201 Vault` |
| `GET` | `/vaults` | – | `200 Vault[]` |
| `GET` | `/vaults/:vaultId` | – | `200 Vault` |
| `DELETE` | `/vaults/:vaultId` | – | `200` |

`keyFingerprint` must be a 64-char hex SHA-256 (else `400`). `Vault`:

```json
{ "id": "uuid", "ownerId": "uuid", "name": "My Vault", "keyFingerprint": "<64 hex>", "createdAt": "ISO8601" }
```

### 6.3 Files

| Method | Path | Body / Params | Success |
|---|---|---|---|
| `PUT` | `/vaults/:vaultId/files` | `{ path, iv, authTag, data, baseVersion? }` | `200 Envelope` |
| `GET` | `/vaults/:vaultId/files` | – | `200 FileItem[]` |
| `GET` | `/vaults/:vaultId/files/:fileId` | – | `200 Envelope` (latest) |
| `GET` | `/vaults/:vaultId/files/:fileId/versions` | – | `200 VersionMeta[]` |
| `GET` | `/vaults/:vaultId/files/:fileId/versions/:versionNo` | – | `200 Envelope` |
| `POST` | `/vaults/:vaultId/files/:fileId/restore/:versionNo` | – | `201 Envelope` (new version) |
| `DELETE` | `/vaults/:vaultId/files/:fileId` | – | `200` |

**FileItem** (list — never contains content):

```json
{ "id": "uuid", "vaultId": "uuid", "path": "Notes/Welcome.md", "currentVersionNo": 2, "updatedAt": "ISO8601" }
```

**Envelope** (single file response):

```json
{
  "file": { "id": "uuid", "vaultId": "uuid", "path": "Notes/Welcome.md", "currentVersionNo": 3, "updatedAt": "ISO8601" },
  "version": { "versionNo": 3, "iv": "base64", "authTag": "base64", "data": "base64", "byteLength": 123, "sha256": "hex", "createdAt": "ISO8601" }
}
```

**VersionMeta** (history item — no blob):

```json
{ "versionNo": 3, "byteLength": 123, "sha256": "hex", "createdAt": "ISO8601" }
```

### 6.4 PUT file semantics (read carefully)

- **Creating a new file:** send `baseVersion: 0` (or omit it).
- **Updating:** send `baseVersion` = the `currentVersionNo` you last saw. Server responds `409` if it changed since.
- Every successful `PUT` **appends a version** — version numbers only increase, history is never rewritten.
- `path` is vault-relative with forward slashes, e.g. `"Notes/Welcome.md"`, `"Home.md"`.

---

## 7. Sync algorithm

The MVP uses **optimistic concurrency with conflict copies** (like Obsidian sync's conflict files). No merge engine.

### Push a note

```ts
// electron/main/sync.ts
import { encryptNote } from './crypto';

async function pushNote(key: Buffer, vaultId: string, note: {
  path: string;
  plaintext: string;
  baseVersion: number; // currentVersionNo last seen, or 0 for new
}): Promise<'saved' | 'conflict'> {
  const env = encryptNote(key, note.plaintext);
  const res = await fetch(`${BASE_URL}/vaults/${vaultId}/files`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ path: note.path, ...env, baseVersion: note.baseVersion }),
  });

  if (res.status === 409) {
    // Someone else changed the file since baseVersion.
    // 1. Keep the local text, rename the local file to <name>-conflict.md
    //    and push THAT as a new file (baseVersion 0).
    // 2. Pull the server's latest for the original path so the user sees it.
    return 'conflict';
  }
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  return 'saved';
}
```

### Pull latest for a path

```ts
async function pullLatest(key: Buffer, vaultId: string, fileId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/vaults/${vaultId}/files/${fileId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const env = (await res.json()) as Envelope;
  return decryptNote(key, env).toString('utf8'); // throws on tamper -> surface it
}
```

### Initial sync

1. `GET /vaults` → pick vault(s).
2. `GET /vaults/:id/files` → full file list.
3. For each file you don't have locally, `GET .../files/:fileId`, decrypt, save locally.
4. For local files not on the server, `PUT` with `baseVersion: 0`.

### Incremental sync (on save / on interval / on focus)

1. Push local changes (track per-file `currentVersionNo` as `baseVersion`).
2. `GET /vaults/:id/files`, diff `updatedAt`/`currentVersionNo` against local state, pull changed files.
3. Handle `409`s as conflict copies.

---

## 8. Restore flow

```ts
async function restoreVersion(key: Buffer, vaultId: string, fileId: string, versionNo: number): Promise<void> {
  // 1. List history to pick a version
  // GET /vaults/:vaultId/files/:fileId/versions  -> VersionMeta[]

  // 2. Restore creates a NEW version (non-destructive)
  const res = await fetch(
    `${BASE_URL}/vaults/${vaultId}/files/${fileId}/restore/${versionNo}`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`restore failed: ${res.status}`);

  // 3. The response is the new current version. Decrypt and replace the local file.
  const env = (await res.json()) as Envelope;
  const plaintext = decryptNote(key, env).toString('utf8');
  await writeLocalFile(fileId, plaintext);
}
```

---

## 9. Error handling

| Status | Meaning | Client action |
|---|---|---|
| `400` | Validation failed (bad iv/tag/data shape, bad keyFingerprint, empty content) | Fix payload; these are client bugs |
| `401` | Missing/invalid token, wrong credentials | Re-login and retry |
| `404` | Vault/file/version not found, or not owned by you | Treat as "gone" — remove local reference or stop syncing it |
| `409` | `baseVersion` mismatch | Create a conflict copy (see §7), then pull latest |
| `5xx` | Server error | Retry with backoff, surface a sync-error banner |

> `404` is also used for **not owned** — the server never reveals whether another user's vault/file exists.

---

## 10. Suggested Electron architecture

```
┌─────────────────────────────────────────────────────┐
│ Renderer (editor UI)                                │
│  - edit plaintext, list notes, show history         │
│  - calls main via IPC: shipi:sync, shipi:getNote    │
├─────────────────────────────────────────────────────┤
│ Main process (trusted: secrets + network)           │
│  - VMK: safeStorage (keychain)                       │
│  - crypto.ts: encrypt/decrypt (never exposed fully) │
│  - shipiClient.ts: fetch wrapper + auth token       │
│  - sync.ts: push/pull/conflict logic                │
│  - local store: decrypted cache on disk (e.g.       │
│    app.getPath('userData')/notes/)                  │
└─────────────────────────────────────────────────────┘
```

- **Never** pass the VMK or plaintext into the renderer's JS context beyond what the UI needs; do decryption in main and hand back strings over IPC.
- Local cache is plaintext on disk — same trust level as the user's own machine (this is normal for an Obsidian clone; the server side is what stays zero-knowledge).
- Put the API client behind a single module so base URL and token handling change in one place.

### Minimal API client

```ts
// electron/main/shipiClient.ts
const BASE_URL = process.env.SHIPI_API_URL ?? 'http://localhost:3000';

let token: string | null = null;

export function setToken(t: string | null): void { token = t; }

function authHeaders(): Record<string, string> {
  if (!token) throw new Error('not authenticated');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const api = {
  register: (email: string, password: string) =>
    fetch(`${BASE_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  listVaults: () => fetch(`${BASE_URL}/vaults`, { headers: authHeaders() }),
  createVault: (name: string, keyFingerprint: string) =>
    fetch(`${BASE_URL}/vaults`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ name, keyFingerprint }),
    }),
  listFiles: (vaultId: string) =>
    fetch(`${BASE_URL}/vaults/${vaultId}/files`, { headers: authHeaders() }),
  pushFile: (vaultId: string, body: object) =>
    fetch(`${BASE_URL}/vaults/${vaultId}/files`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
    }),
  getFile: (vaultId: string, fileId: string) =>
    fetch(`${BASE_URL}/vaults/${vaultId}/files/${fileId}`, { headers: authHeaders() }),
  listVersions: (vaultId: string, fileId: string) =>
    fetch(`${BASE_URL}/vaults/${vaultId}/files/${fileId}/versions`, { headers: authHeaders() }),
  restoreVersion: (vaultId: string, fileId: string, versionNo: number) =>
    fetch(`${BASE_URL}/vaults/${vaultId}/files/${fileId}/restore/${versionNo}`, {
      method: 'POST', headers: authHeaders(),
    }),
};
```

---

## 11. Security checklist

- [ ] Notes are **always** encrypted with AES-256-GCM before `PUT`; never send plaintext.
- [ ] Fresh random 12-byte IV per file; never reuse an IV for a VMK.
- [ ] VMK only in `safeStorage`; only the SHA-256 fingerprint goes to the server.
- [ ] HTTPS in production; fail sync loudly on TLS errors.
- [ ] Check `status === 409` and make conflict copies; don't blindly overwrite.
- [ ] Catch decrypt errors (wrong key / tamper) and show them; never silently write garbage.
- [ ] Never log envelopes, blobs, keys, or tokens.
- [ ] Wipe VMK + cached plaintext on vault "remove" / logout if the user requests it.
- [ ] Use `authHeaders()` centrally so tokens never leak into URLs or logs.

---

## 12. Known backend limits (plan around them)

- No refresh tokens — re-login on `401`.
- No rate limiting on `/auth/login` yet (fine for MVP; add client-side backoff on repeated 401/429).
- No folder-as-object API — a folder is just a `path` prefix (`Notes/...`). Create implicit folders by path on first push.
- No file rename/move endpoint in MVP — delete + re-push.
- Full-text search is client-side only (server can't see plaintext).
- `DELETE /vaults/:vaultId` permanently removes the vault and all versions.

---

## 13. Native-app sync client (implemented)

`native-app/src/main/sync.ts` is the sync engine in the Electron main process; the renderer drives it through IPC (`window.shipi.syncSignIn/signUp/signOut/syncNow/syncPush`), surfaced in the **Sync panel** at the bottom of the sidebar.

- **VMK lifecycle:** a 32-byte VMK is generated on first sign-in and persisted (base64) in `sync-state.json` under Electron `userData`. Only its SHA-256 fingerprint is sent to the server when linking/creating the remote vault.
- **Encryption:** per-file `AES-256-GCM` with a fresh 12-byte IV; envelope `{ iv, authTag, data }` matches the server DTO exactly (padded base64 `authTag` is accepted — the backend accepts both padded and unpadded).
- **Push:** every `.md` file is encrypted and upserted with `baseVersion = <last-known versionNo>` (or `0` for new files). Unchanged files (same plaintext SHA-256) are skipped. Files deleted locally are `DELETE`d remotely.
- **Pull:** remote files are decrypted and written locally (creating folders by path). If a local file was edited since the last sync, the remote version is saved as a `<name>-conflict-<timestamp>.md` copy and the local edit wins the path.
- **Push 409:** the remote version is fetched and wins the path; the local edit is preserved as `<name>-conflict-<timestamp>.md`.
- **Auto-sync:** a debounced `syncPush()` runs after every save (600 ms) and on Cmd/Ctrl+S; the manual **Sync** button runs pull + push. App start shows current status; re-login is required on `401` (token expiry).
- **Dev port:** the app defaults to `http://localhost:3001` (override with `SHIPI_API_URL`) because the electron-forge webpack dev server occupies `:3000`.
