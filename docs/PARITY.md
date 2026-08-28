# Shipi parity matrix

Tracks feature parity between the Electron desktop app (`native-app/`) and the mobile app (`mobile-app/`). Keep this in sync whenever either app changes.

Legend: ✅ implemented · ⚠️ differs (documented) · ❌ missing

## Core vault

| Feature | Desktop (`native-app`) | Mobile (`mobile-app`) | Notes |
| --- | --- | --- | --- |
| Vault root creation | ✅ `Documents/Shipi/My Vault` | ✅ `Paths.document/Shipi/My Vault` | Mobile stores inside the app sandbox (no Documents permission needed). |
| `Welcome.md` seeded on first run | ✅ | ✅ | Copy adapted per platform (left panel → Vault/Editor tabs). |
| File tree (nested, folders first, alphabetical) | ✅ `fsService.buildTree` | ✅ `lib/vault.buildTree` | |
| Hidden files (`.` prefix) skipped | ✅ | ✅ | |
| `.md` extension auto-append on create/rename | ✅ | ✅ | |
| Collision-safe names (`name-1.md`, `name-2.md`, …) | ✅ | ✅ | |
| Path traversal guards (`..`, absolute) | ✅ | ✅ | |
| Create note / folder (root + nested) | ✅ | ✅ | |
| Rename entry (file or folder) | ✅ | ✅ | |
| Delete entry (recursive for folders) | ✅ | ✅ | Native: `window.confirm`; Mobile: `Alert.alert` destructive. |

## Editor

| Feature | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Open note, show name in header | ✅ | ✅ | |
| Markdown editing | ✅ CodeMirror | ✅ `TextInput` (monospace) | Desktop uses CodeMirror; mobile uses native text input. |
| Live preview | ✅ CodeMirror live-preview decorations | ✅ `MarkdownPreview` renderer | Same feature set: headings 1–6, bold/italic/strike, inline code, links, blockquote, ordered/unordered lists, task lists, fenced code, horizontal rule, tables rendered as source text only. |
| Source / Live toggle | ✅ | ✅ (`Source` / `Preview`) | |
| Autosave (600 ms debounce) | ✅ | ✅ | |
| Manual save shortcut | ✅ Cmd/Ctrl+S | ❌ | Mobile has no system save key; autosave covers it. |
| Task checkbox toggling in preview | ✅ clickable | ❌ | Desktop widgets toggle `[x]`; mobile preview is read-only for now. |
| Dirty indicator dot | ✅ | ✅ | |
| Empty state | ✅ | ✅ | |

## Sync (zero-knowledge)

| Feature | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Crypto | ✅ Node `aes-256-gcm`, 12B IV, 16B authTag, `iv`/`authTag`/`data` base64 | ✅ `expo-crypto` AES APIs, same format | Wire-compatible with the desktop server payloads. |
| VMK (32-byte key) generated + stored | ✅ `sync-state.json` (userData) | ✅ `expo-secure-store` | Mobile keeps key/token in the secure keychain. |
| Key fingerprint = SHA-256(VMK) | ✅ | ✅ | |
| Sign up / sign in (`POST /auth/register`, `/auth/login`) | ✅ | ✅ | |
| Sign in with Google (`/auth/google` redirect flow) | ✅ modal `BrowserWindow` + loopback callback | ✅ `WebBrowser.openAuthSessionAsync` + `shipi://auth` scheme | Same email = same account; accounts link across providers. |
| Auto sign-out on 401 ("Session expired") | ✅ | ✅ | |
| Vault lookup-or-create by fingerprint (`GET/POST /vaults`) | ✅ | ✅ | |
| Push (`PUT /vaults/:id/files`, `baseVersion`) | ✅ | ✅ | |
| Delete remote on local delete (`DELETE`) | ✅ | ✅ | |
| Pull (`GET /vaults/:id/files`) | ✅ | ✅ | |
| Conflict on push (409) → local copy + overwrite with remote | ✅ | ✅ | |
| Conflict on pull (local modified) → remote copy + keep local | ✅ | ✅ | |
| Sync state persisted (`files`, `versionNo`, `localSha256`) | ✅ JSON file | ✅ JSON file (`shipi-sync-state.json`) | |
| Status messages + last-synced time | ✅ | ✅ | |
| Serialized sync runs (single in-flight) | ✅ | ✅ | |
| API base URL override | ✅ `SHIPI_API_URL` env | ✅ `EXPO_PUBLIC_SHIPI_API_URL` env, default `http://localhost:3001` | |

## UI / design

| Feature | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Notion design tokens (DESIGN.md) | ✅ CSS vars | ✅ `theme/tokens.ts` | Shared source of truth. |
| Sidebar with New note / New folder + tree + sync panel | ✅ | ✅ Vault tab | Desktop splits panes; mobile uses a tabbed layout. |
| TreeItem hover actions (create-in-folder, rename, delete) | ✅ | ✅ always visible on row | Touch devices have no hover. |
| SyncPanel (sign-in form / account row) | ✅ | ✅ | |
| Title bar with vault name + path | ✅ | ⚠️ | Mobile shows "My Vault" in the Vault tab header; no OS title bar. |

## Behavior notes

- **Welcome copy**: each app writes a platform-appropriate `Welcome.md`. Treat as intentionally divergent copy, not a parity bug.
- **Markdown tables**: rendered as source text in both apps (desktop live preview does not render tables either).
- **Autosave + sync**: both apps push to sync after each debounced save; the sync engine serializes pushes so saves during a sync are queued and picked up on the next push.
