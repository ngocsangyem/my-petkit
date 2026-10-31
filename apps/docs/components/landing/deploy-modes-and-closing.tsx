import Link from 'next/link';
import { localizePath, type Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n-dictionaries';
import { gitConfig } from '@/lib/shared';
import { SectionHead } from './section-head';

const MODES = [
  { id: 'addon', where: 'HAOS / Supervised' },
  { id: 'container', where: 'deploy/local/' },
  { id: 'cloud', where: 'deploy/cloud/' },
] as const;

const DOCS = [
  { id: 'install', href: '/docs/install' },
  { id: 'addDevice', href: '/docs/guides/add-a-device' },
  { id: 'configure', href: '/docs/configuration' },
  { id: 'firmware', href: '/docs/firmware' },
  { id: 'devices', href: '/docs/devices' },
  { id: 'contribute', href: '/docs/contributing' },
] as const;

export function DeployModes({ t }: { t: Dictionary['deploy'] }) {
  return (
    <section className="lp-block lp-block-tight" id="install">
      <div className="lp-wrap">
        <SectionHead eyebrow={t.eyebrow} title={t.title}>
          {t.lede}
        </SectionHead>
        <div className="lp-modes" data-lp-reveal="">
          {MODES.map((m) => (
            <article className="lp-mode" key={m.id}>
              <h3>{t.modes[m.id].title}</h3>
              <p>{t.modes[m.id].body}</p>
              <code>{m.where}</code>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta({ t, lang }: { t: Dictionary['closing']; lang: Locale }) {
  return (
    <section className="lp-block lp-block-tight">
      <div className="lp-wrap">
        <div className="lp-closing" data-lp-scale-in="">
          <div>
            <h2>{t.title}</h2>
            <div className="lp-ctas">
              <Link className="lp-btn lp-btn-primary" data-lp-magnet href={localizePath('/docs/install/home-assistant-add-on', lang)}>
                {t.ctaInstall}
              </Link>
              <a className="lp-btn lp-btn-secondary" data-lp-magnet href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}>
                {t.ctaGithub}
              </a>
            </div>
          </div>
          <nav className="lp-docs-list" aria-label={t.docsLabel}>
            {DOCS.map((d) => (
              <Link key={d.id} href={localizePath(d.href, lang)}>
                {t.docs[d.id].title}
                <span>{t.docs[d.id].hint}</span>
              </Link>
            ))}
          </nav>
        </div>
        <p className="lp-warning">{t.warning}</p>
      </div>
    </section>
  );
}
