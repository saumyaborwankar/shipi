import * as fs from 'fs';
import * as path from 'path';
import { FileNode } from '../shared/ipc';
import { getVaultRoot } from './vault';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function assertValidName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new Error('Invalid name');
  }
}

function resolveDir(relDir: string | null): string {
  const root = getVaultRoot();
  if (!relDir) {
    return root;
  }
  const cleaned = relDir.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(root, cleaned);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

function resolveFile(relPath: string): string {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) {
    throw new Error('Invalid path');
  }
  const root = getVaultRoot();
  const resolved = path.resolve(root, cleaned);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel === '') {
    throw new Error('Invalid path');
  }
  return resolved;
}

function ensureMarkdownExt(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
}

function uniquePath(dir: string, name: string): string {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = path.join(dir, name);
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}-${n}${ext}`);
    n += 1;
  }
  return candidate;
}

export function buildTree(): FileNode[] {
  const root = getVaultRoot();

  const walk = (dir: string, baseRel: string): FileNode[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const relPath = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          relPath,
          type: 'folder',
          children: walk(path.join(dir, entry.name), relPath),
        });
      } else {
        nodes.push({ name: entry.name, relPath, type: 'file' });
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  };

  return walk(root, '');
}

export function readFile(relPath: string): string {
  return fs.readFileSync(resolveFile(relPath), 'utf8');
}

export function writeFile(relPath: string, content: string): void {
  const abs = resolveFile(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

export function createFile(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const dir = resolveDir(parentRelPath);
  const target = uniquePath(dir, ensureMarkdownExt(name));
  fs.writeFileSync(target, '', 'utf8');
  return toPosix(path.relative(getVaultRoot(), target));
}

export function createFolder(parentRelPath: string | null, name: string): string {
  assertValidName(name);
  const dir = resolveDir(parentRelPath);
  const target = uniquePath(dir, name.trim());
  fs.mkdirSync(target, { recursive: true });
  return toPosix(path.relative(getVaultRoot(), target));
}

export function renameEntry(relPath: string, newName: string): string {
  assertValidName(newName);
  const abs = resolveFile(relPath);
  const dir = path.dirname(abs);
  const isFile = fs.statSync(abs).isFile();
  const finalName = isFile ? ensureMarkdownExt(newName) : newName.trim();
  const target = uniquePath(dir, finalName);
  fs.renameSync(abs, target);
  return toPosix(path.relative(getVaultRoot(), target));
}

export function deleteEntry(relPath: string): void {
  const abs = resolveFile(relPath);
  fs.rmSync(abs, { recursive: true, force: true });
}
