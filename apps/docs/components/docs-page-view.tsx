import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getMDXComponents } from '@/components/mdx';
import type { Locale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';
import { languageAlternates } from '@/lib/site-metadata';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';
import { source } from '@/lib/source';

// The docs layout, page, metadata and params for one language. The English and `/vi` route
// trees render these with their own locale; a page without a translation resolves to the
// English file under the localized URL (loader fallback).

export function DocsLayoutView({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree(lang)} {...baseOptions(lang)}>
      {children}
    </DocsLayout>
  );
}

export function DocsPageView({ lang, slug }: { lang: Locale; slug: string[] | undefined }) {
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${gitConfig.contentDir}/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function docsPageParams(lang: Locale) {
  return source.getPages(lang).map((page) => ({ slug: page.slugs }));
}

export function docsPageMetadata(lang: Locale, slug: string[] | undefined): Metadata {
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  // Same slugs in the default language: the URL every language variant shares after the prefix
  const path = source.getPage(page.slugs)?.url ?? page.url;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: languageAlternates(path, lang),
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}
