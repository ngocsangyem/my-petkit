// Fails on Tailwind classes that break the hard rules of
// docs/design/design-reference.md §6. shadcn components arrive with some of
// these by default, so every `shadcn add` is followed by an edit and this
// check keeps the edits from being undone:
// - a shadow on a resting element: only overlays (dialog, alert dialog,
//   sheet, popover, menu, tooltip, toast) may carry `shadow-overlay`;
// - letter-spacing or uppercase labels;
// - glass or blur, and gradients;
// - Tailwind palette colours (`bg-black/50`, `text-white`, `red-500`)
//   instead of the theme's token-backed colours.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OVERLAYS = new Set(
  ['dialog', 'alert-dialog', 'sheet', 'popover', 'dropdown-menu', 'tooltip', 'toast'].map(
    name => `src/shared/ui/shadcn/${name}.tsx`,
  ),
).add('src/shared/ui/toast.tsx');
const PALETTE =
  'black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RULES = [
  {
    name: 'shadow on a resting element',
    re: /(?<![\w-])shadow-(?!none\b)[\w/[\]-]+/,
    overlaysMay: true,
  },
  { name: 'letter-spacing', re: /(?<![\w-])tracking-[\w[\].-]+/ },
  { name: 'uppercase label', re: /(?<![\w-])uppercase(?![\w-])/ },
  {
    name: 'blur or glass',
    re: /(?<![\w-])(?:[\w-]+:)*(?:backdrop-blur(?:-[\w[\]]+)?|blur-[\w[\]]+|backdrop-filter)(?![\w-])/,
  },
  {
    name: 'gradient',
    re: /(?<![\w-])bg-(?:linear|radial|conic|gradient)-|(?<![\w-])(?:from|via|to)-(?:\w+-)?\d{2,3}\b/,
  },
  {
    name: 'palette colour instead of a theme colour',
    re: new RegExp(
      `(?<![\\w-])(?:[\\w-]+:)*(?:bg|text|border|ring|fill|stroke|outline|from|to|via|divide|shadow|decoration|accent|caret)-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`,
    ),
  },
];
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) check(path);
  }
}

function check(path) {
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const rule of RULES) {
        const match = line.match(rule.re);
        if (!match) continue;
        if (rule.overlaysMay && OVERLAYS.has(path) && match[0] === 'shadow-overlay') continue;
        hits.push(`${path}:${i + 1}: ${rule.name}: ${match[0]}`);
      }
    });
}

walk('src');
if (hits.length) {
  console.error(`Design rule violations (design-reference.md §6):\n${hits.join('\n')}`);
  process.exit(1);
}
