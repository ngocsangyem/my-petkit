import { pageImageParams, pageImageResponse } from '@/lib/docs-route-handlers';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/vi/og/docs/[...slug]'>) {
  return pageImageResponse('vi', (await params).slug);
}

export function generateStaticParams() {
  return pageImageParams('vi');
}
