import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const VAULT_DIR_NAME = 'Shipi';
export const DEFAULT_VAULT_NAME = 'My Vault';

let vaultRoot: string | null = null;

export function getVaultRoot(): string {
  if (!vaultRoot) {
    throw new Error('Vault not initialized');
  }
  return vaultRoot;
}

export function getVaultName(): string {
  return DEFAULT_VAULT_NAME;
}

export function ensureVault(): void {
  const base = path.join(app.getPath('documents'), VAULT_DIR_NAME);
  const root = path.join(base, DEFAULT_VAULT_NAME);

  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'Welcome.md'), WELCOME_MD, 'utf8');
  }

  vaultRoot = root;
}

const WELCOME_MD = `# Welcome to Shipi

This is your vault — a local folder of plain-text \`.md\` files on your device.
Everything you create lives on disk and can be opened with any text editor.

## Working here

- The **left panel** is your file tree. Create notes and folders with the buttons at the top, or right-click a folder's hover actions.
- Click any note to open it in the editor on the right.
- Your notes **save automatically** as you type (Ctrl/Cmd + S also saves).
- The editor renders markdown **live** as you type — start a line with \`# \` and watch it become a heading. Use the **Source** button in the editor header to edit raw markdown anytime.
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
