# Shipi Backend

Backend for Shipi — a zero-knowledge sync service for an Obsidian-style Markdown app. The Electron app (out of scope here) encrypts every note client-side; this API only stores and version-syncs already-encrypted blobs.

## How encryption works

- The Electron app generates a 32-byte **Vault Master Key (VMK)** when a vault is created. It never leaves the device — it is shown once and downloadable as a `.key` file.
- Notes are encrypted with **AES-256-GCM** (per-file random 12-byte IV + 16-byte auth tag) before upload.
- This server stores only the ciphertext envelope `{ iv, authTag, data }` plus metadata (path, size, sha256, timestamps). It can never read note content.
- `POST /vaults` records a `keyFingerprint` (SHA-256 of the VMK) so the client can verify key downloads without the server ever holding the key.
- Lost key = permanent data loss. That is the zero-knowledge tradeoff.

## Storage

- Metadata in Postgres (Supabase). Encrypted blobs in `file_versions.blob` (bytea) behind a `BlobStorageService` interface — swap in an S3-backed implementation without touching callers.
- Transport: TLS. Blobs are client-encrypted at rest.

## API

Auth (JWT, 7d expiry):

```
POST /auth/register  { email, password }        -> { accessToken, user }
POST /auth/login     { email, password }        -> { accessToken, user }
GET  /auth/me                                    -> { id, email }
```

Vaults (all require `Authorization: Bearer <token>`):

```
POST   /vaults           { name, keyFingerprint }   -> vault
GET    /vaults                                      -> vaults[]
GET    /vaults/:vaultId                             -> vault
DELETE /vaults/:vaultId
```

Files — every save appends a new version (never rewrites history):

```
PUT    /vaults/:vaultId/files          { path, iv, authTag, data, baseVersion? } -> { file, version }
GET    /vaults/:vaultId/files                                                     -> file list (no content)
GET    /vaults/:vaultId/files/:fileId                                             -> latest version envelope
GET    /vaults/:vaultId/files/:fileId/versions                                    -> version history (no blobs)
GET    /vaults/:vaultId/files/:fileId/versions/:versionNo                         -> specific version
POST   /vaults/:vaultId/files/:fileId/restore/:versionNo                          -> new version from old blob (201)
DELETE /vaults/:vaultId/files/:fileId
```

Envelope format: `iv` = base64 of 12-byte GCM nonce, `authTag` = base64 of 16-byte GCM tag, `data` = base64 ciphertext. The server validates sizes but does not decrypt.

### Sync / conflicts (MVP)

The client sends `baseVersion` (the `versionNo` it last saw). If the file changed since, the server responds `409` and the client saves a conflict copy. New files must omit `baseVersion` or send `0`.

## Getting started

```bash
cp .env.example .env        # fill in Supabase creds + JWT_SECRET
npm install
npm run migration:run       # applies migrations in src/migrations
npm run start:dev
```

## Scripts

```bash
npm run build        # compile
npm run start:dev    # run with watch mode
npm run lint         # eslint + prettier
npm test             # unit tests
npm run test:e2e     # e2e (needs a live DB via .env)
npm run migration:generate -- src/migrations/<Name>
npm run migration:run | revert | show
```

## Tests

- Unit: auth, vaults, files services (18 tests).
- e2e (`test/app.e2e-spec.ts`): full register → vault → encrypted upload → version bump → 409 conflict → restore — using a real AES-256-GCM fixture, plus ownership isolation and envelope validation.
