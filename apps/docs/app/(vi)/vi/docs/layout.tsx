import { DocsLayoutView } from '@/components/docs-page-view';

export default function Layout({ children }: LayoutProps<'/vi/docs'>) {
  return <DocsLayoutView lang="vi">{children}</DocsLayoutView>;
}
