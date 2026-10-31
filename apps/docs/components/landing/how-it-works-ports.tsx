import type { Dictionary } from '@/lib/i18n-dictionaries';
import { SectionHead } from './section-head';

const PORTS = [
  { id: 'deviceApi', port: 80, proto: 'HTTP' },
  { id: 'broker', port: 443, proto: 'TLS' },
  { id: 'bucket', port: 9000, proto: 'HTTPS' },
  { id: 'dashboard', port: 8443, proto: 'TLS', user: true },
] as const;

/** The four servers the one process runs, and which side of the two planes each sits on. */
export function HowItWorksPorts({ t }: { t: Dictionary['ports'] }) {
  return (
    <section className="lp-block" id="how-it-works">
      <div className="lp-wrap">
        <SectionHead eyebrow={t.eyebrow} title={t.title}>
          {t.lede}
        </SectionHead>
        <div className="lp-ports" data-lp-reveal="">
          {PORTS.map((p) => {
            const user = 'user' in p && p.user;
            return (
            <article className="lp-port" key={p.port}>
              <div className="lp-port-num">
                <span data-lp-count={p.port}>{p.port}</span>
                <small>{p.proto}</small>
              </div>
              <h3>{t.items[p.id].title}</h3>
              <p>{t.items[p.id].body}</p>
              <span className="lp-plane" data-user={user || undefined}>
                {user ? t.userPlane : t.devicePlane}
              </span>
            </article>
            );
          })}
        </div>
        <div className="lp-planes">
          <div>
            <b>{t.devicePlane}</b> {t.devicePlaneNote}
          </div>
          <div>
            <b>{t.userPlane}</b> {t.userPlaneNote}
          </div>
        </div>
      </div>
    </section>
  );
}
