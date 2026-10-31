import { pageMarkdownParams, pageMarkdownResponse } from '@/lib/docs-route-handlers';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/llms.mdx/docs/[[...slug]]'>) {
  return pageMarkdownResponse('en', (await params).slug);
}

export function generateStaticParams() {
  return pageMarkdownParams('en');
}
