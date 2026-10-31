import { llmsIndexResponse } from '@/lib/docs-route-handlers';

export const revalidate = false;

export function GET() {
  return llmsIndexResponse('en');
}
