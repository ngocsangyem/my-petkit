import type { Resource, ResourceLanguage } from 'i18next';

// Every `locales/{language}/{namespace}.json` is bundled at build time: a new
// namespace is a new pair of files, with no list here to keep in step.
const FILES = import.meta.glob<ResourceLanguage[string]>('./locales/*/*.json', {
  eager: true,
  import: 'default',
});

const PATH = /\/locales\/([a-z]{2})\/([a-z][\w-]*)\.json$/;

/** `{ en: { common: {...}, app: {...} }, vi: {...} }` from the bundled JSON files. */
export function toResources(files: Readonly<Record<string, ResourceLanguage[string]>>): Resource {
  const byLanguage = new Map<string, Map<string, ResourceLanguage[string]>>();
  for (const [path, data] of Object.entries(files)) {
    const match = PATH.exec(path);
    if (!match?.[1] || !match[2]) throw new Error(`Unexpected locale file: ${path}`);
    const namespaces = byLanguage.get(match[1]) ?? new Map<string, ResourceLanguage[string]>();
    namespaces.set(match[2], data);
    byLanguage.set(match[1], namespaces);
  }
  return Object.fromEntries(
    [...byLanguage].map(([language, namespaces]) => [language, Object.fromEntries(namespaces)]),
  );
}

export const resources: Resource = toResources(FILES);
