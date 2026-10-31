'use client';

import Link from 'next/link';
import { animate, stagger } from 'motion';
import { useRef, useState } from 'react';
import { localizePath, type Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n-dictionaries';
import { gsap, navOffset, NARROW, prefersReducedMotion, useGSAP, WIDE } from './gsap-setup';

const MONO = 'IBM Plex Mono, monospace';

/**
 * The page's thesis as one scrubbed scene: a litter box whose packets travel to
 * api.petkit.com, then, as the reader scrolls, to a server in the house instead.
 */
export function HeroRedirectScene({ t, lang }: { t: Dictionary['hero']; lang: Locale }) {
  const root = useRef<HTMLElement>(null);
  const [home, setHome] = useState(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const linkCloud = q<SVGPathElement>('[data-link=cloud]')[0];
      const linkHome = q<SVGPathElement>('[data-link=home]')[0];
      const packets = q<SVGCircleElement>('[data-packet]');
      const lenCloud = linkCloud.getTotalLength();
      const lenHome = linkHome.getTotalLength();
      // Share of the three packets already riding the home link, 0..1
      const state = { homeShare: 0 };

      const placePackets = (t: number) => {
        packets.forEach((p, i) => {
          const f = (t * 0.35 + i / 3) % 1;
          const toHome = i / 3 < state.homeShare;
          const pt = (toHome ? linkHome : linkCloud).getPointAtLength(f * (toHome ? lenHome : lenCloud));
          p.setAttribute('cx', String(pt.x));
          p.setAttribute('cy', String(pt.y));
          p.style.fill = toHome ? 'var(--lp-accent)' : 'var(--lp-warning)';
          p.style.opacity = f < 0.06 || f > 0.94 ? '0' : '1';
        });
      };

      gsap.set(linkHome, { strokeDasharray: lenHome, strokeDashoffset: lenHome });

      if (prefersReducedMotion()) {
        state.homeShare = 1;
        gsap.set(linkHome, { strokeDashoffset: 0 });
        gsap.set(q('[data-cloud-cut]'), { strokeDashoffset: 0 });
        gsap.set(linkCloud, { opacity: 0.2 });
        placePackets(0.4);
        setHome(true);
        return;
      }

      gsap.ticker.add(placePackets);

      animate(q('.lp-word'), { opacity: [0, 1], y: [28, 0] }, { delay: stagger(0.06), type: 'spring', stiffness: 220, damping: 22 });
      gsap.from(q('.lp-scene'), { y: 24, scale: 0.98, duration: 1, ease: 'power3.out', delay: 0.2 });
      gsap.fromTo(q('[data-hint]'), { scaleY: 0 }, { scaleY: 1, duration: 1.1, repeat: -1, yoyo: true, ease: 'power2.inOut' });

      // Pinned and scrubbed on wide screens; on phones the scene plays as it passes
      const mm = gsap.matchMedia();
      mm.add({ wide: WIDE, narrow: NARROW }, (ctx) => {
        const wide = Boolean(ctx.conditions?.wide);
        gsap
          .timeline({
            scrollTrigger: {
              trigger: wide ? root.current : q('.lp-scene')[0],
              start: wide ? () => `top top+=${navOffset()}` : 'top 70%',
              end: wide ? '+=900' : 'bottom 30%',
              pin: wide,
              scrub: 0.6,
              onUpdate: (self) => setHome(self.progress > 0.55),
            },
          })
          .to(linkHome, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0)
          .to(state, { homeShare: 1, duration: 1, ease: 'none' }, 0.3)
          .to(linkCloud, { opacity: 0.15, duration: 0.6 }, 0.5)
          .to(q('[data-cloud-cut]'), { strokeDashoffset: 0, duration: 0.5 }, 0.7)
          .to(q('[data-cloud]'), { opacity: 0.45, duration: 0.5 }, 0.8)
          .fromTo(q('[data-server]'), { scale: 1 }, { scale: 1.05, svgOrigin: '540 310', yoyo: true, repeat: 1, duration: 0.25 }, 1);
      });

      return () => {
        gsap.ticker.remove(placePackets);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <section className="lp-hero" ref={root}>
      <div className="lp-wrap lp-hero-grid">
        <div>
          <p className="lp-eyebrow">{t.eyebrow}</p>
          <h1>
            {t.headline.map((w) => (
              <span key={w}>
                <span className="lp-word">{w}</span>{' '}
              </span>
            ))}
            {t.headlineAccent.map((w) => (
              <span key={w}>
                <em className="lp-word">{w}</em>{' '}
              </span>
            ))}
            {t.headlineTail.map((w) => (
              <span key={w}>
                <span className="lp-word">{w}</span>{' '}
              </span>
            ))}
          </h1>
          <p className="lp-lede">{t.lede}</p>
          <div className="lp-ctas">
            <Link className="lp-btn lp-btn-primary" data-lp-magnet href={localizePath('/docs/install/home-assistant-add-on', lang)}>
              {t.ctaInstall}
            </Link>
            <Link className="lp-btn lp-btn-secondary" data-lp-magnet href={localizePath('/docs', lang)}>
              {t.ctaDocs}
            </Link>
          </div>
          <div className="lp-facts">
            {t.facts.map((f) => (
              <span className="lp-chip" key={f}>
                <i />
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="lp-scene">
          <div className="lp-status" data-home={home}>
            <i />
            <span>{home ? t.statusHome : t.statusCloud}</span>
          </div>
          <svg viewBox="0 0 640 400" role="img" aria-label={t.sceneLabel}>
            <g data-cloud="">
              <path
                d="M470 118c-3-26 18-46 42-44 9-20 40-26 56-10 26-6 46 16 40 40 18 6 22 36 0 42H480c-18 0-26-22-10-28z"
                fill="var(--lp-raised)"
                stroke="var(--lp-drawing-stroke)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <text x="540" y="172" textAnchor="middle" fontFamily={MONO} fontSize="13" fill="var(--lp-muted)">
                api.petkit.com
              </text>
              <line data-cloud-cut="" x1="452" y1="70" x2="628" y2="160" stroke="var(--lp-error)" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
            </g>
            <g data-server="">
              <path d="M470 300 L540 248 L610 300 V360 H470 Z" fill="var(--lp-drawing-fill)" stroke="var(--lp-drawing-stroke)" strokeWidth="2.5" strokeLinejoin="round" />
              <rect x="505" y="300" width="70" height="34" rx="6" fill="var(--lp-accent-soft)" stroke="var(--lp-drawing-stroke)" strokeWidth="2" />
              <circle cx="518" cy="317" r="3.5" fill="var(--lp-accent)" />
              <line x1="530" y1="317" x2="562" y2="317" stroke="var(--lp-drawing-stroke)" strokeWidth="2" strokeLinecap="round" />
              <text x="540" y="384" textAnchor="middle" fontFamily={MONO} fontSize="13" fill="var(--lp-muted)">
                my-petkit · 192.168.1.20
              </text>
            </g>
            <path data-link="cloud" d="M190 210 C 300 210, 360 120, 462 120" fill="none" stroke="var(--lp-drawing-stroke)" strokeWidth="2" strokeDasharray="5 7" opacity=".55" />
            <path data-link="home" d="M190 220 C 300 220, 360 315, 466 315" fill="none" stroke="var(--lp-accent)" strokeWidth="3" strokeLinecap="round" />
            {[0, 1, 2].map((i) => (
              <circle key={i} data-packet="" r="5" style={{ opacity: 0 }} />
            ))}
            {/* The litter box, drawn the way the app draws devices */}
            <g>
              <circle cx="110" cy="200" r="78" fill="var(--lp-drawing-fill)" />
              <path d="M34 214 A78 78 0 0 0 186 214 Z" fill="var(--lp-litter)" />
              <circle cx="110" cy="200" r="78" fill="none" stroke="var(--lp-drawing-stroke)" strokeWidth="5" />
              <ellipse cx="110" cy="196" rx="44" ry="34" fill="var(--lp-drawing-fill)" stroke="var(--lp-drawing-stroke)" strokeWidth="5" />
              <rect x="50" y="286" width="120" height="22" rx="11" fill="var(--lp-drawing-fill)" stroke="var(--lp-drawing-stroke)" strokeWidth="5" />
              <text x="110" y="338" textAnchor="middle" fontFamily={MONO} fontSize="13" fill="var(--lp-muted)">
                Purobot Ultra · T6
              </text>
            </g>
          </svg>
          <div className="lp-caption">
            {home ? (
              <span>
                <b>{t.afterLabel}</b> {t.after}
              </span>
            ) : (
              <span>
                <b>{t.beforeLabel}</b> {t.before}
              </span>
            )}
            <span className="font-mono">{home ? t.afterNote : t.scrollCue}</span>
          </div>
        </div>
      </div>
      <div className="lp-wrap">
        <div className="lp-hint">
          <span data-hint="" />
          {t.hint}
        </div>
      </div>
    </section>
  );
}
