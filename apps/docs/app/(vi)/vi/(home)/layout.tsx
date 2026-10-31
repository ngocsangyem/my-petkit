import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/vi'>) {
  return <HomeLayout {...baseOptions('vi')}>{children}</HomeLayout>;
}
