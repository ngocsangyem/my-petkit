import { createGetUrl } from 'fumadocs-core/source';
import { i18n } from './i18n';

export const appName = 'MyPetKit';
export const siteUrl = 'https://my-petkit.vercel.app';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'ngocsangyem',
  repo: 'my-petkit',
  branch: 'main',
  // Where this app's MDX lives inside the repository, for "edit on GitHub" links.
  contentDir: 'apps/docs/content/docs',
};

// Same locale rule as page URLs: English unprefixed, other languages under `/{lang}`.
const getContentUrl = createGetUrl(docsContentRoute, i18n);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute, i18n);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
