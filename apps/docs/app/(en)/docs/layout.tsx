import { DocsLayoutView } from '@/components/docs-page-view';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return <DocsLayoutView lang="en">{children}</DocsLayoutView>;
}
