// Fails when a hex colour appears anywhere in src/ outside the token file:
// every colour is a token (docs/design/design-reference.md §2).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const ALLOWED = new Set(['src/shared/ui/tokens.css', 'src/api/schema.d.ts']);
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(css|ts|tsx)$/.test(entry.name) && !ALLOWED.has(path)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HEX.test(line)) hits.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    }
  }
}

walk('src');
if (hits.length) {
  console.error(`Hex colours outside tokens.css:\n${hits.join('\n')}`);
  process.exit(1);
}
