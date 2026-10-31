import { pageImageParams, pageImageResponse } from '@/lib/docs-route-handlers';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  return pageImageResponse('en', (await params).slug);
}

export function generateStaticParams() {
  return pageImageParams('en');
}
