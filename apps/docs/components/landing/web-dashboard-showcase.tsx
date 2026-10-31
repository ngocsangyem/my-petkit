'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { gsap, navOffset, prefersReducedMotion, useGSAP } from './gsap-setup';
import { SectionHead } from './section-head';

const SCREENS = [
  { src: 'web-home.webp', url: 'my-petkit.local:8443', title: 'Home', body: 'The fountain has been silent since 06:10. Everything else is fine.', alt: 'Dashboard home: the fountain has been silent since 06:10, two cats with visit counts' },
  { src: 'web-home-dark.webp', url: 'my-petkit.local:8443 · dark', title: 'Dark mode', body: 'One dark value per light token, on web and iOS alike.', alt: 'Dashboard home in dark mode' },
  { src: 'web-timeline.webp', url: 'my-petkit.local:8443/timeline', title: 'Timeline', body: 'Every visit, clean and clip, cut at local midnight.', alt: 'Dashboard timeline of visits and cleanings' },
  { src: 'web-patchers.webp', url: 'my-petkit.local:8443/patchers', title: 'Patchers', body: 'What each on-device patch changes, and how to undo it.', alt: 'Dashboard firmware patchers screen' },
];

/** Dashboard screenshots: a pinned horizontal track on wide screens, a plain stack on phones. */
export function WebDashboardShowcase() {
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
        <SectionHead eyebrow="Web dashboard" title="The same house, on a bigger screen.">
          Colour is spent only on data and status. When something needs you, the home screen says so in a sentence, not
          a badge.
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
                <span>{s.url}</span>
              </div>
              <Image src={`/screenshots/${s.src}`} alt={s.alt} width={756} height={469} />
            </div>
            <figcaption>
              <b>{s.title}</b>
              {s.body}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
