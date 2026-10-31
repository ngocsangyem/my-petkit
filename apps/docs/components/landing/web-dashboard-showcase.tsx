'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { gsap, navOffset, prefersReducedMotion, useGSAP } from './gsap-setup';
import type { Dictionary } from '@/lib/i18n-dictionaries';
import { SectionHead } from './section-head';

const SCREENS = [
  { id: 'home', src: 'web-home.webp', url: 'my-petkit.local:8443', dark: false },
  { id: 'dark', src: 'web-home-dark.webp', url: 'my-petkit.local:8443', dark: true },
  { id: 'timeline', src: 'web-timeline.webp', url: 'my-petkit.local:8443/timeline', dark: false },
  { id: 'patchers', src: 'web-patchers.webp', url: 'my-petkit.local:8443/patchers', dark: false },
] as const;

/** Dashboard screenshots: a pinned horizontal track on wide screens, a plain stack on phones. */
export function WebDashboardShowcase({ t }: { t: Dictionary['dashboard'] }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      const track = q('.lp-track')[0] as HTMLElement;
      const mm = gsap.matchMedia();
      mm.add('(min-width: 761px)', () => {
        const distance = () => track.scrollWidth - window.innerWidth + 40;
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: () => `top top+=${navOffset()}`, end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
      });
      mm.add('(max-width: 760px)', () => {
        q('.lp-panel').forEach((panel) => gsap.from(panel, { y: 40, opacity: 0.2, duration: 0.7, scrollTrigger: { trigger: panel, start: 'top 90%' } }));
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section className="lp-block lp-block-tight" ref={root}>
      <div className="lp-wrap">
        <SectionHead eyebrow={t.eyebrow} title={t.title}>
          {t.lede}
        </SectionHead>
      </div>
      <div className="lp-track">
        {SCREENS.map((s) => (
          <figure className="lp-panel" key={s.src}>
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <i />
                <i />
                <i />
                <span>{s.dark ? `${s.url} · ${t.darkUrlSuffix}` : s.url}</span>
              </div>
              <Image src={`/screenshots/${s.src}`} alt={t.screens[s.id].alt} width={756} height={469} />
            </div>
            <figcaption>
              <b>{t.screens[s.id].title}</b>
              {t.screens[s.id].body}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
