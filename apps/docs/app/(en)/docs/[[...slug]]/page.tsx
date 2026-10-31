import type { Metadata } from 'next';
import { DocsPageView, docsPageMetadata, docsPageParams } from '@/components/docs-page-view';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params;
  return <DocsPageView lang="en" slug={slug} />;
}

export function generateStaticParams() {
  return docsPageParams('en');
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const { slug } = await props.params;
  return docsPageMetadata('en', slug);
}
