import { notFound } from 'next/navigation';
import { generateOGImage } from 'fumadocs-ui/og';
import type { Locale } from './i18n';
import { docsLlms, source } from './source';
import { appName, getPageImageUrl, getPageMarkdownUrl } from './shared';

// Bodies of the static text and image routes, shared by the English tree and the `/vi` tree
// so each route file only names its language.

export async function llmsIndexResponse(lang: Locale) {
  return new Response(await docsLlms.index(lang));
}

export async function llmsFullResponse(lang: Locale) {
  return new Response(await docsLlms.full(lang));
}

export async function pageMarkdownResponse(lang: Locale, slug: string[] | undefined) {
  // remove the appended "content.md"
  const page = source.getPage(slug?.slice(0, -1), lang);
  if (!page) notFound();

  return new Response(await docsLlms.page(page), {
    headers: { 'Content-Type': 'text/markdown' },
  });
}

export function pageMarkdownParams(lang: Locale) {
  return source.getPages(lang).map((page) => ({ slug: getPageMarkdownUrl(page).segments }));
}

export function pageImageResponse(lang: Locale, slug: string[]) {
  // remove the appended "image.png"
  const page = source.getPage(slug.slice(0, -1), lang);
  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: appName,
  });
}

export function pageImageParams(lang: Locale) {
  return source.getPages(lang).map((page) => ({ slug: getPageImageUrl(page).segments }));
}
