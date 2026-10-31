import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';
import { landingMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = landingMetadata('en');

export default function HomePage() {
  return <LandingPage lang="en" />;
}
