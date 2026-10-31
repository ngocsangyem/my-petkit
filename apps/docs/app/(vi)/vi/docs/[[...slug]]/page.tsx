import type { Metadata } from 'next';
import { DocsPageView, docsPageMetadata, docsPageParams } from '@/components/docs-page-view';

export default async function Page(props: PageProps<'/vi/docs/[[...slug]]'>) {
  const { slug } = await props.params;
  return <DocsPageView lang="vi" slug={slug} />;
}

export function generateStaticParams() {
  return docsPageParams('vi');
}

export async function generateMetadata(props: PageProps<'/vi/docs/[[...slug]]'>): Promise<Metadata> {
  const { slug } = await props.params;
  return docsPageMetadata('vi', slug);
}
