import type { EnvironmentBlock } from '@/ble/provisioning-payload';
import { RiskNotice } from '@/shared/ui';

const HOSTED = 'https://petkit.2442.pl';

/** The sentence on the disabled controls, from the same source as the notice. */
export function environmentTooltip(block: EnvironmentBlock): string | undefined {
  if (block === 'insecure-context')
    return 'Web Bluetooth needs a secure page, and this one is plain HTTP. See the note above.';
  if (block === 'no-web-bluetooth')
    return 'This browser has no Web Bluetooth. Use Chrome or Edge, on desktop or Android.';
  return undefined;
}

/** Why the form is switched off: an insecure page first, then a browser without Web Bluetooth. */
export function EnvironmentNotice({ block }: { block: EnvironmentBlock }) {
  if (block === 'insecure-context') {
    return (
      <RiskNotice>
        Web Bluetooth only works on a secure page, and this one is plain HTTP. Serve Home Assistant
        over HTTPS with your own certificate; provisioning then works from this page, Ingress
        included. You will need Chrome or Edge as well. A plain-HTTP page cannot tell whether you
        have one, because the browser hides Web Bluetooth entirely until the page is secure. Or use
        the hosted provisioning page at{' '}
        <a href={HOSTED} target="_blank" rel="noopener noreferrer" className="font-mono">
          {HOSTED}
        </a>
        , which runs entirely in your browser and talks to the device over Bluetooth. It never sees
        your Wi-Fi password.
      </RiskNotice>
    );
  }
  if (block === 'no-web-bluetooth') {
    return (
      <RiskNotice>
        This browser has no Web Bluetooth. It is only in Chrome and Edge, on desktop or Android;
        Firefox, Safari and iOS cannot provision. On an iPhone, use the MyPetKit app.
      </RiskNotice>
    );
  }
  return null;
}
