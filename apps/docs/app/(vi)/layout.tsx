import type { Metadata } from 'next';
import { RootDocument } from '@/components/root-document';
import { rootMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = rootMetadata('vi');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="vi">{children}</RootDocument>;
}
