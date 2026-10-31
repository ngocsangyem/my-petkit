import '@fontsource/ibm-plex-sans-condensed/700.css';
import './landing.css';
import type { Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n-dictionaries';
import { ClosingCta, DeployModes } from './deploy-modes-and-closing';
import { DeviceFamilies } from './device-families';
import { HeroRedirectScene } from './hero-redirect-scene';
import { HowItWorksPorts } from './how-it-works-ports';
import { LandingScrollEffects } from './landing-scroll-effects';
import { PhoneDemo } from './phone-demo';
import { TransportTimeline } from './transport-timeline';
import { WebDashboardShowcase } from './web-dashboard-showcase';

// Sections run in story order: the redirect, the app in use, what the server runs,
// the transport switch, the dashboard, what connects, where it installs.
export function LandingPage({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);

  return (
    <main className="lp flex-1">
      <HeroRedirectScene t={t.hero} lang={lang} />
      <PhoneDemo t={t.phone} />
      <HowItWorksPorts t={t.ports} />
      <TransportTimeline t={t.transport} />
      <WebDashboardShowcase t={t.dashboard} />
      <DeviceFamilies t={t.families} />
      <DeployModes t={t.deploy} />
      <ClosingCta t={t.closing} lang={lang} />
      <LandingScrollEffects />
    </main>
  );
}
