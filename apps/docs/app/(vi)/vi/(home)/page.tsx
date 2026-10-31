import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';
import { landingMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = landingMetadata('vi');

export default function HomePage() {
  return <LandingPage lang="vi" />;
}
