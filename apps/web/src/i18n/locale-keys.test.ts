import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGES } from './language';
import { resources } from './locale-resources';

// Plural forms are keys like any other: every language carries the same set,
// since runtimes disagree on which form Vietnamese picks for 1.
const PLURAL = /_(zero|one|two|few|many|other)$/;

type Tree = Readonly<Record<string, unknown>>;

/** `{ a: { b: 'x' } }` as `[['a.b', 'x']]`. */
function leaves(tree: Tree, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]): [string, unknown][] =>
    typeof value === 'object' && value !== null
      ? leaves(value as Tree, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

function namespaces(language: string): Tree {
  return resources[language] ?? {};
}

/** The `{{name}}` placeholders and `<tag>`s of a value, which a translation must keep. */
function slots(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}|<\/?([\w-]+)\s*\/?>/g)]
    .map(m => m[1] ?? `<${m[2] ?? ''}>`)
    .sort();
}

const english = namespaces(DEFAULT_LANGUAGE);
const others = LANGUAGES.filter(l => l !== DEFAULT_LANGUAGE);

describe('locale resources', () => {
  it('ship the same namespaces in every language', () => {
    for (const language of others) {
      expect(Object.keys(namespaces(language)).sort()).toEqual(Object.keys(english).sort());
    }
  });

  it.each(Object.keys(english))('give namespace %s the same keys in every language', ns => {
    const keys = (language: string) =>
      leaves((namespaces(language)[ns] ?? {}) as Tree)
        .map(([k]) => k)
        .sort();
    for (const language of others) expect(keys(language)).toEqual(keys(DEFAULT_LANGUAGE));
  });

  it('give every plural an "other" form and every value non-empty text', () => {
    for (const language of LANGUAGES) {
      for (const [ns, tree] of Object.entries(namespaces(language))) {
        const entries = leaves(tree as Tree);
        const keys = new Set(entries.map(([k]) => k));
        for (const [key, value] of entries) {
          expect(typeof value === 'string' && value.trim() !== '', `${language}/${ns}:${key}`).toBe(
            true,
          );
          if (PLURAL.test(key)) expect(keys.has(key.replace(PLURAL, '_other'))).toBe(true);
        }
      }
    }
  });

  it('keep the placeholders and tags of the English text', () => {
    for (const [ns, tree] of Object.entries(english)) {
      const source = new Map(leaves(tree as Tree));
      for (const language of others) {
        for (const [key, value] of leaves((namespaces(language)[ns] ?? {}) as Tree)) {
          const original = source.get(key);
          expect(slots(String(value)), `${language}/${ns}:${key}`).toEqual(slots(String(original)));
        }
      }
    }
  });
});
