'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { gsap, navOffset, NARROW, prefersReducedMotion, ScrollTrigger, useGSAP, WIDE } from './gsap-setup';
import type { Dictionary } from '@/lib/i18n-dictionaries';
import { buildPhoneDemoTimeline, PHONE_DEMO_STEPS } from './phone-demo-timeline';
import { SectionHead } from './section-head';

function Screenshot({ src }: { src: string }) {
  return <Image src={src} alt="" width={390} height={src.includes('live') ? 844 : 1120} style={{ height: 'auto' }} />;
}

/** A pinned iPhone that a simulated finger operates as the reader scrolls. */
export function PhoneDemo({ t }: { t: Dictionary['phone'] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      const { tl, labels } = buildPhoneDemoTimeline(gsap, q);
      const progress = q('[data-progress]');
      // Follow the timeline itself, not the scroll: scrub keeps easing after scrolling stops
      tl.eventCallback('onUpdate', () => {
        setActive(Math.max(0, labels.indexOf(tl.currentLabel())));
        gsap.set(progress, { scaleX: tl.progress() });
      });

      // Longer runway on wide screens so each gesture reads; the stage pins, the heading scrolls away
      const mm = gsap.matchMedia();
      mm.add({ wide: WIDE, narrow: NARROW }, (ctx) => {
        const narrow = ctx.conditions?.narrow;
        const phone = q('.lp-phone')[0] as HTMLElement;
        const steps = q('.lp-demo > div:first-child')[0] as HTMLElement;
        // While pinned the stage cannot scroll, so on a short phone the screen shrinks until
        // phone + steps fit under the header (paddings 32, gap 20, bezel 20). Runs before each
        // refresh measures; mobile address-bar resizes do not trigger one.
        const fitPhone = () => {
          const room = window.innerHeight - navOffset() - steps.offsetHeight - 72;
          phone.style.setProperty('--s', String(gsap.utils.clamp(0.36, 0.56, room / 844)));
        };
        if (narrow) {
          fitPhone();
          ScrollTrigger.addEventListener('refreshInit', fitPhone);
        }
        ScrollTrigger.create({
          animation: tl,
          trigger: q('.lp-demo')[0],
          start: () => `top top+=${navOffset()}`,
          end: narrow ? '+=2800' : '+=3600',
          pin: true,
          // Touch scrolling keeps moving for a frame before the pin applies; pre-empting it avoids a jump
          anticipatePin: 1,
          scrub: 0.8,
        });
        return () => {
          ScrollTrigger.removeEventListener('refreshInit', fitPhone);
          phone.style.removeProperty('--s');
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section className="lp-block" ref={root}>
      <div className="lp-wrap">
        <SectionHead eyebrow={t.eyebrow} title={t.title}>
          {t.lede}
        </SectionHead>
        <div className="lp-demo">
          <div>
            <ol className="lp-steps">
              {PHONE_DEMO_STEPS.map((step, i) => (
                <li className="lp-step" key={step} data-active={i === active}>
                  <b>{t.steps[step].title}</b>
                  <p>{t.steps[step].body}</p>
                </li>
              ))}
            </ol>
            <div className="lp-progress">
              <i data-progress="" />
            </div>
          </div>

          <div className="lp-phone" role="img" aria-label={t.phoneLabel}>
            <div className="lp-glass">
              <div className="lp-island" />
              <div className="lp-screen">
                <div className="lp-page" data-page="home">
                  <Screenshot src="/screenshots/ios-devices.webp" />
                  <div className="lp-tabbar" style={{ backgroundImage: 'url(/screenshots/ios-devices.webp)' }} />
                </div>
                <div className="lp-page" data-page="timeline" style={{ opacity: 0 }}>
                  <Screenshot src="/screenshots/ios-timeline.webp" />
                  <div className="lp-tabbar" style={{ backgroundImage: 'url(/screenshots/ios-timeline.webp)' }} />
                </div>
                <div className="lp-shade" data-shade="home" />
                <div className="lp-page lp-page-offstage" data-page="t6">
                  <Screenshot src="/screenshots/ios-device-t6.webp" />
                  <div className="lp-shade" data-shade="t6" />
                  <div className="lp-sheet-bg" data-sheet-bg="" />
                  <div className="lp-sheet" data-sheet="">
                    <span className="lp-grab" />
                    <h4>{t.sheetTitle}</h4>
                    <p>{t.sheetBody}</p>
                    <span className="lp-sheet-btn" data-primary="">
                      {t.sheetConfirm}
                    </span>
                    <span className="lp-sheet-btn">{t.sheetCancel}</span>
                  </div>
                  <div className="lp-toast" data-toast="">
                    <i />
                    {t.toast}
                  </div>
                </div>
                <div className="lp-page lp-page-dark lp-page-offstage" data-page="live">
                  <Screenshot src="/screenshots/ios-live.webp" />
                </div>
                <div className="lp-ripple" data-ripple="" />
                <div className="lp-finger" data-finger="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
