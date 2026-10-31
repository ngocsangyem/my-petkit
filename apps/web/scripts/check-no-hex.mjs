// Fails when a hex colour appears in src/ outside the token file: every colour
// is a token (docs/design/DESIGN.md). In CSS any `#rgb`..`#rrggbbaa`
// counts; in TypeScript only a string that IS a colour (`'#0f6e66'`), so a
// media path such as `.../#10000001/...` is not mistaken for one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS_HEX = /#[0-9a-fA-F]{3,8}\b/;
const TS_HEX = /['"`]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/;
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
          const pattern = path.endsWith('.css') ? CSS_HEX : TS_HEX;
          if (pattern.test(line)) hits.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    }
  }
}

walk('src');
if (hits.length) {
  console.error(`Hex colours outside tokens.css:\n${hits.join('\n')}`);
  process.exit(1);
}
