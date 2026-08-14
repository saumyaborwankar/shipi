import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { DEFAULT_VAULT_NAME, VAULT_DIR_NAME } from './config';
import type { FileNode } from './types';

const isWeb = Platform.OS === 'web';

const WELCOME_MD = `# Welcome to Shipi

This is your vault — a local folder of plain-text \`.md\` files on your device.
Everything you create lives on disk and can be opened with any text editor.

## Working here

- The **Vault** tab is your file tree. Create notes and folders with the buttons at the top, or tap a folder's row actions.
- Tap any note to open it in the **Editor** tab.
- Your notes **save automatically** as you type.
- The editor renders markdown **live** — tap **Preview** to switch from source to the rendered view.

## Markdown you can use

# Heading 1
## Heading 2
### Heading 3

**Bold**, *italic*, and ~~strikethrough~~.

> A blockquote for calling things out.

1. Ordered lists
2. With items

- Unordered lists
- With items

- [x] A finished task
- [ ] A task to do

\`Inline code\` and fenced blocks:

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Feature | Status |
| --- | --- |
| Local vault | Done |
| Markdown editing | Done |

[Links](https://example.com) and images too.

---

Happy writing!
`;

const WEB_PREFIX = 'shipi:vault:';

function sortNodes(nodes: FileNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }
}

function assertValidName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new Error('Invalid name');
  }
}

function assertValidRelPath(relPath: string): void {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) {
    throw new Error('Invalid path');
  }
  for (const part of cleaned.split('/')) {
    if (part === '' || part === '.' || part === '..') {
      throw new Error('Invalid path');
    }
  }
}

function ensureMarkdownExt(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
}

function uniqueName(exists: (candidate: string) => boolean, name: string, ext: string): string {
  let candidate = name;
  let n = 1;
  const base = ext ? name.slice(0, name.length - ext.length) : name;
  while (exists(candidate)) {
    candidate = `${base}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/* ── Native (expo-file-system) ─────────────────────────── */

function vaultRoot(): Directory {
  return new Directory(Paths.document, VAULT_DIR_NAME, DEFAULT_VAULT_NAME);
}

function toFile(relPath: string): File {
  assertValidRelPath(relPath);
  return new File(vaultRoot(), ...relPath.split('/'));
}

function toDir(relPath: string): Directory {
  assertValidRelPath(relPath);
  return new Directory(vaultRoot(), ...relPath.split('/'));
}

function relFromAbs(absUri: string): string {
  const root = vaultRoot().uri;
  let rel = absUri;
  if (rel.startsWith(root)) {
    rel = rel.slice(root.length);
  }
  return rel.replace(/^\/+/, '');
}

function ensureVaultNative(): void {
  const root = vaultRoot();
  if (!root.exists) {
    root.create({ intermediates: true });
  }
  const welcome = new File(root, 'Welcome.md');
  if (!welcome.exists) {
    welcome.create();
    welcome.write(WELCOME_MD);
  }
}

function buildTreeNative(): FileNode[] {
  const root = vaultRoot();
  if (!root.exists) {
    return [];
  }

  const walk = (dir: Directory, baseRel: string): FileNode[] => {
    let entries: (File | Directory)[];
    try {
      entries = dir.list();
    } catch {
      return [];
    }
    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const relPath = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry instanceof Directory) {
        nodes.push({
          name: entry.name,
          relPath,
          type: 'folder',
          children: walk(entry, relPath),
        });
      } else {
        nodes.push({ name: entry.name, relPath, type: 'file' });
      }
    }
    sortNodes(nodes);
    return nodes;
  };

  return walk(root, '');
}

async function readFileNative(relPath: string): Promise<string> {
  return toFile(relPath).text();
}

async function writeFileNative(relPath: string, content: string): Promise<void> {
  const file = toFile(relPath);
  const dir = new Directory(file.parentDirectory.uri);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  if (!file.exists) {
    file.create();
  }
  file.write(content);
}

function createFileNative(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const dir = parentRelPath ? toDir(parentRelPath) : vaultRoot();
  const finalName = ensureMarkdownExt(name);
  const ext = finalName.slice(finalName.length - 3);
  const target = uniqueName(
    (candidate) => new File(dir, candidate).exists,
    finalName,
    ext,
  );
  const file = new File(dir, target);
  file.create({ intermediates: true });
  file.write('');
  return relFromAbs(file.uri);
}

function createFolderNative(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const dir = parentRelPath ? toDir(parentRelPath) : vaultRoot();
  const target = uniqueName(
    (candidate) => new Directory(dir, candidate).exists,
    name.trim(),
    '',
  );
  const created = new Directory(dir, target);
  created.create({ intermediates: true });
  return relFromAbs(created.uri);
}

function renameEntryNative(relPath: string, newName: string): string {
  assertValidName(newName);
  const parent = new Directory(toFile(relPath).parentDirectory.uri);
  const isFile = !new Directory(relPath.startsWith('..') ? '' : toDir(relPath).uri).exists;
  let finalName = newName.trim();
  let ext = '';
  if (isFile) {
    finalName = ensureMarkdownExt(newName);
    ext = finalName.slice(finalName.length - 3);
  }
  const target = uniqueName(
    (candidate) => {
      try {
        return isFile ? new File(parent, candidate).exists : new Directory(parent, candidate).exists;
      } catch {
        return false;
      }
    },
    finalName,
    ext,
  );
  if (isFile) {
    const file = toFile(relPath);
    file.rename(target);
    return relFromAbs(file.uri);
  }
  const dir = toDir(relPath);
  dir.rename(target);
  return relFromAbs(dir.uri);
}

function deleteEntryNative(relPath: string): void {
  const file = toFile(relPath);
  if (file.exists) {
    file.delete();
    return;
  }
  const dir = toDir(relPath);
  if (dir.exists) {
    dir.delete();
  }
}

async function fileExistsNative(relPath: string): Promise<boolean> {
  try {
    return toFile(relPath).exists;
  } catch {
    return false;
  }
}

/* ── Web (localStorage) ────────────────────────────────── */

function webStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available');
  }
  return localStorage;
}

function webRead(relPath: string): string {
  return webStorage().getItem(WEB_PREFIX + relPath) ?? '';
}

function webWrite(relPath: string, content: string): void {
  webStorage().setItem(WEB_PREFIX + relPath, content);
}

function webDelete(relPath: string): void {
  const prefix = WEB_PREFIX + relPath;
  const keys = Object.keys(webStorage()).filter(
    (key) => key.startsWith(prefix) && (key === prefix || key.startsWith(`${prefix}/`)),
  );
  for (const key of keys) {
    webStorage().removeItem(key);
  }
}

function ensureVaultWeb(): void {
  if (!webStorage().getItem(WEB_PREFIX + 'Welcome.md')) {
    webWrite('Welcome.md', WELCOME_MD);
  }
}

function buildTreeWeb(): FileNode[] {
  const files = Object.keys(webStorage())
    .filter((key) => key.startsWith(WEB_PREFIX))
    .map((key) => key.slice(WEB_PREFIX.length))
    .sort();
  const nodes: FileNode[] = [];
  for (const rel of files) {
    const segments = rel.split('/');
    let current = nodes;
    let acc = '';
    segments.forEach((seg, i) => {
      acc = acc ? `${acc}/${seg}` : seg;
      let node = current.find((n) => n.name === seg);
      if (!node) {
        const isFile = i === segments.length - 1;
        node = { name: seg, relPath: acc, type: isFile ? 'file' : 'folder', children: isFile ? undefined : [] };
        current.push(node);
      }
      if (!node.children && i < segments.length - 1) {
        node.children = [];
      }
      if (i < segments.length - 1 && node.children) {
        current = node.children;
      }
    });
  }
  sortNodes(nodes);
  return nodes;
}

async function readFileWeb(relPath: string): Promise<string> {
  assertValidRelPath(relPath);
  return webRead(relPath);
}

async function writeFileWeb(relPath: string, content: string): Promise<void> {
  assertValidRelPath(relPath);
  webWrite(relPath, content);
}

function createFileWeb(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const base = parentRelPath ? `${parentRelPath}/` : '';
  const finalName = ensureMarkdownExt(name);
  const ext = finalName.slice(finalName.length - 3);
  const target = uniqueName(
    (candidate) => webStorage().getItem(WEB_PREFIX + base + candidate) !== null,
    finalName,
    ext,
  );
  const relPath = base + target;
  webWrite(relPath, '');
  return relPath;
}

function createFolderWeb(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const base = parentRelPath ? `${parentRelPath}/` : '';
  const target = uniqueName(
    (candidate) => Object.keys(webStorage()).some((key) =>
      key.startsWith(WEB_PREFIX + base + candidate + '/'),
    ),
    name.trim(),
    '',
  );
  return base + target;
}

function renameEntryWeb(relPath: string, newName: string): string {
  assertValidName(newName);
  const isFile = !webStorage().getItem(WEB_PREFIX + relPath + '/');
  const finalName = isFile ? ensureMarkdownExt(newName) : newName.trim();
  const parent = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/') + 1) : '';
  const target = uniqueName(
    (candidate) =>
      Object.keys(webStorage()).some(
        (key) =>
          key.startsWith(WEB_PREFIX + parent + candidate) &&
          (key === WEB_PREFIX + parent + candidate ||
            key.startsWith(WEB_PREFIX + parent + candidate + '/')),
      ),
    finalName,
    isFile ? finalName.slice(finalName.length - 3) : '',
  );
  const oldPrefix = WEB_PREFIX + relPath;
  const newPrefix = WEB_PREFIX + parent + target;
  const keys = Object.keys(webStorage()).filter((key) =>
    key.startsWith(oldPrefix) && (key === oldPrefix || key.startsWith(`${oldPrefix}/`)),
  );
  for (const key of keys) {
    const value = webStorage().getItem(key);
    webStorage().removeItem(key);
    if (value !== null) {
      const rest = key.slice(oldPrefix.length);
      webStorage().setItem(newPrefix + rest, value);
    }
  }
  return parent + target;
}

function deleteEntryWeb(relPath: string): void {
  webDelete(relPath);
}

async function fileExistsWeb(relPath: string): Promise<boolean> {
  assertValidRelPath(relPath);
  return webStorage().getItem(WEB_PREFIX + relPath) !== null;
}

/* ── Public API ────────────────────────────────────────── */

export function ensureVault(): void {
  if (isWeb) {
    ensureVaultWeb();
  } else {
    ensureVaultNative();
  }
}

export function buildTree(): FileNode[] {
  return isWeb ? buildTreeWeb() : buildTreeNative();
}

export function readFile(relPath: string): Promise<string> {
  return isWeb ? readFileWeb(relPath) : readFileNative(relPath);
}

export function writeFile(relPath: string, content: string): Promise<void> {
  return isWeb ? writeFileWeb(relPath, content) : writeFileNative(relPath, content);
}

export function createFile(parentRelPath: string | null, name: string): string {
  return isWeb ? createFileWeb(parentRelPath, name) : createFileNative(parentRelPath, name);
}

export function createFolder(parentRelPath: string | null, name: string): string {
  return isWeb ? createFolderWeb(parentRelPath, name) : createFolderNative(parentRelPath, name);
}

export function renameEntry(relPath: string, newName: string): string {
  return isWeb ? renameEntryWeb(relPath, newName) : renameEntryNative(relPath, newName);
}

export function deleteEntry(relPath: string): void {
  if (isWeb) {
    deleteEntryWeb(relPath);
  } else {
    deleteEntryNative(relPath);
  }
}

export async function fileExists(relPath: string): Promise<boolean> {
  return isWeb ? fileExistsWeb(relPath) : fileExistsNative(relPath);
}

export function getVaultName(): string {
  return DEFAULT_VAULT_NAME;
}

export function getVaultRootPath(): string {
  if (isWeb) {
    return `${VAULT_DIR_NAME}/${DEFAULT_VAULT_NAME}`;
  }
  return vaultRoot().uri;
}
