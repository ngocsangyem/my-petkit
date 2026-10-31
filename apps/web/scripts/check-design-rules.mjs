// Fails on code that breaks the hard design rules: docs/design/design-reference.md
// §6, as relaxed for v3 by §7.3 and §8.2. shadcn components arrive with some of
// these by default, so every `shadcn add` is followed by an edit and this check
// keeps the edits from being undone.
//
// Allowed by v3, so not checked: radius-20 cards, pill controls (rounded-full),
// icons above quick-action labels, and the dark caption pill over photos (its
// rgba(0,0,0,.55) lives in tokens.css as `--pk-caption-bg`, used as `bg-caption`).
//
// Banned:
// - a shadow on a resting element: only overlays that float (dialog, alert
//   dialog, sheet, popover, menu, tooltip, toast) may carry `shadow-overlay`
//   or `shadow-sheet`, and no file may use an arbitrary `shadow-[…]`;
// - letter-spacing or uppercase labels;
// - glass or blur, and gradients (in classes and in plain CSS);
// - Tailwind palette colours (`bg-black/50`, `text-white`, `red-500`)
//   instead of the theme's token-backed colours;
// - emoji, in any source string or comment.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OVERLAYS = new Set(
  ['dialog', 'alert-dialog', 'sheet', 'popover', 'dropdown-menu', 'tooltip', 'toast'].map(
    name => `src/shared/ui/shadcn/${name}.tsx`,
  ),
).add('src/shared/ui/toast.tsx');
const OVERLAY_SHADOWS = new Set(['shadow-overlay', 'shadow-sheet']);
const PALETTE =
  'black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
// Pictographs drawn as emoji by default, and the variation selector that turns
// a text symbol into one. Text symbols such as the middle dot, arrows or the
// em dash are not emoji and stay allowed.
const EMOJI = /[\p{Emoji_Presentation}\u{FE0F}]/u;

const TS_RULES = [
  {
    name: 'shadow on a resting element',
    re: /(?<![\w-])shadow-(?!none\b)[\w/[\]-]+/,
    overlaysMay: true,
  },
  { name: 'letter-spacing', re: /(?<![\w-])tracking-[\w[\].-]+/ },
  { name: 'uppercase label', re: /(?<![\w-])uppercase(?![\w-])/ },
  {
    name: 'blur or glass',
    re: /(?<![\w-])(?:backdrop-blur|blur-[\w[\]]|backdrop-filter)/,
  },
  {
    name: 'gradient',
    re: /(?<![\w-])(?:bg-(?:linear|radial|conic|gradient)-|(?:from|via|to)-[a-z]+-\d{2,3}\b)/,
  },
  {
    name: 'palette colour instead of a theme colour',
    re: new RegExp(
      `(?<![\\w-])(?:bg|text|border|ring|fill|stroke|outline|from|to|via|divide|shadow|decoration|accent|caret)-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`,
    ),
  },
  { name: 'emoji', re: EMOJI },
];

// Plain CSS: tokens.css alone may define shadows (as tokens); nothing may draw
// a gradient, blur or glass, or space letters out.
const CSS_RULES = [
  { name: 'gradient', re: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/ },
  { name: 'blur or glass', re: /\bbackdrop-filter\b|\bblur\(/ },
  { name: 'letter-spacing', re: /\bletter-spacing\s*:\s*(?!0\b|normal\b)/ },
  { name: 'uppercase label', re: /\btext-transform\s*:\s*uppercase\b/ },
  { name: 'shadow outside the tokens', re: /\bbox-shadow\s*:/, tokensMay: true },
  { name: 'emoji', re: EMOJI },
];
const TOKENS = 'src/shared/ui/tokens.css';
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) check(path, TS_RULES);
    else if (entry.name.endsWith('.css')) check(path, CSS_RULES);
  }
}

function allowed(rule, path, match) {
  if (rule.overlaysMay && OVERLAYS.has(path) && OVERLAY_SHADOWS.has(match)) return true;
  if (rule.tokensMay && path === TOKENS) return true;
  return false;
}

function check(path, rules) {
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const rule of rules) {
        const match = line.match(rule.re);
        if (!match || allowed(rule, path, match[0])) continue;
        hits.push(`${path}:${i + 1}: ${rule.name}: ${match[0]}`);
      }
    });
}

walk('src');
if (hits.length) {
  console.error(
    `Design rule violations (design-reference.md §6, §7.3, §8.2):\n${hits.join('\n')}`,
  );
  process.exit(1);
}
