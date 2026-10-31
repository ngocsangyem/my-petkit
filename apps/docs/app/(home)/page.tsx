import '@fontsource/ibm-plex-sans-condensed/700.css';
import '@/components/landing/landing.css';
import { ClosingCta, DeployModes } from '@/components/landing/deploy-modes-and-closing';
import { DeviceFamilies } from '@/components/landing/device-families';
import { HeroRedirectScene } from '@/components/landing/hero-redirect-scene';
import { HowItWorksPorts } from '@/components/landing/how-it-works-ports';
import { LandingScrollEffects } from '@/components/landing/landing-scroll-effects';
import { PhoneDemo } from '@/components/landing/phone-demo';
import { TransportTimeline } from '@/components/landing/transport-timeline';
import { WebDashboardShowcase } from '@/components/landing/web-dashboard-showcase';

// Sections run in story order: the redirect, the app in use, what the server runs,
// the transport switch, the dashboard, what connects, where it installs.
export default function HomePage() {
  return (
    <main className="lp flex-1">
      <HeroRedirectScene />
      <PhoneDemo />
      <HowItWorksPorts />
      <TransportTimeline />
      <WebDashboardShowcase />
      <DeviceFamilies />
      <DeployModes />
      <ClosingCta />
      <LandingScrollEffects />
    </main>
  );
}
