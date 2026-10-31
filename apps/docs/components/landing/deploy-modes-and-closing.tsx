import Link from 'next/link';
import { gitConfig } from '@/lib/shared';
import { SectionHead } from './section-head';

const MODES = [
  { title: 'Home Assistant add-on', body: 'Add the repository in the add-on store. The dashboard opens through Ingress; the iOS app pairs with a QR code.', where: 'HAOS / Supervised' },
  { title: 'Local container', body: 'Any Docker host on your LAN. Self-signed TLS, pinned by the iOS app through the pairing QR.', where: 'deploy/local/' },
  { title: 'Cloud / VPS', body: "Reached over WireGuard. Only the user plane is public, behind Caddy and Let's Encrypt.", where: 'deploy/cloud/' },
];

const DOCS = [
  { href: '/docs/install', title: 'Install', hint: 'HA, container, VPS' },
  { href: '/docs/guides/add-a-device', title: 'Add a device', hint: 'Wi-Fi and server address' },
  { href: '/docs/configuration', title: 'Configure', hint: 'Every option and port' },
  { href: '/docs/firmware', title: 'Firmware and patchers', hint: 'What changes, how to undo' },
  { href: '/docs/devices', title: 'Device reference', hint: 'Buttons, lights, limits' },
  { href: '/docs/contributing', title: 'Contribute', hint: 'Tests and protocol rules' },
];

export function DeployModes() {
  return (
    <section className="lp-block lp-block-tight" id="install">
      <div className="lp-wrap">
        <SectionHead eyebrow="Install" title="Same signed image, three places to run it.">
          Every mode runs the same multi-architecture image. Pick the one that matches the machine you already have.
        </SectionHead>
        <div className="lp-modes" data-lp-reveal="">
          {MODES.map((m) => (
            <article className="lp-mode" key={m.title}>
              <h3>{m.title}</h3>
              <p>{m.body}</p>
              <code>{m.where}</code>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="lp-block lp-block-tight">
      <div className="lp-wrap">
        <div className="lp-closing" data-lp-scale-in="">
          <div>
            <h2>Unplug the internet. The litter box keeps cleaning.</h2>
            <div className="lp-ctas">
              <Link className="lp-btn lp-btn-primary" data-lp-magnet href="/docs/install/home-assistant-add-on">
                Install the add-on
              </Link>
              <a className="lp-btn lp-btn-secondary" data-lp-magnet href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}>
                View on GitHub
              </a>
            </div>
          </div>
          <nav className="lp-docs-list" aria-label="Documentation">
            {DOCS.map((d) => (
              <Link key={d.href} href={d.href}>
                {d.title}
                <span>{d.hint}</span>
              </Link>
            ))}
          </nav>
        </div>
        <p className="lp-warning">
          Pointing a device at MyPetKit, and above all applying the firmware patchers, is done at your own risk. A
          patched or misconfigured device can stop working and falls outside its warranty and PetKit&apos;s update path.
        </p>
      </div>
    </section>
  );
}
