'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { gsap, navOffset, NARROW, prefersReducedMotion, ScrollTrigger, useGSAP, WIDE } from './gsap-setup';
import { buildPhoneDemoTimeline } from './phone-demo-timeline';
import { SectionHead } from './section-head';

const STEPS = [
  ['Open the app at home', 'The home screen says what needs you, in a sentence: the fountain has been silent since 06:10.'],
  ['Tap the litter box', "Status, bags left, litter level and consumables, read from the box's own state report."],
  ['Clean now, after a confirm', 'Every command asks before it runs. Confirm, and it reaches the box over MQTT straight away.'],
  ['Watch it live', 'WebRTC through the bundled go2rtc, under a second behind. Also plays in Home Assistant.'],
  ['Read the day back', 'Swipe back to the timeline: every visit, meal and clip, cut at local midnight.'],
] as const;

function Screenshot({ src }: { src: string }) {
  return <Image src={src} alt="" width={390} height={src.includes('live') ? 844 : 1120} style={{ height: 'auto' }} />;
}

/** A pinned iPhone that a simulated finger operates as the reader scrolls. */
export function PhoneDemo() {
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
        ScrollTrigger.create({
          animation: tl,
          trigger: q('.lp-demo')[0],
          start: () => `top top+=${navOffset()}`,
          end: ctx.conditions?.wide ? '+=3600' : '+=2800',
          pin: true,
          scrub: 0.8,
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section className="lp-block" ref={root}>
      <div className="lp-wrap">
        <SectionHead eyebrow="The iOS app" title="Keep scrolling. The phone does the tapping.">
          Every screen below is the real app talking to a server on the same Wi-Fi. Commands go out over MQTT, so the
          box moves the moment you confirm.
        </SectionHead>
        <div className="lp-demo">
          <div>
            <ol className="lp-steps">
              {STEPS.map(([title, body], i) => (
                <li className="lp-step" key={title} data-active={i === active}>
                  <b>{title}</b>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
            <div className="lp-progress">
              <i data-progress="" />
            </div>
          </div>

          <div className="lp-phone" role="img" aria-label="iPhone running MyPetKit, operated by a simulated finger as you scroll">
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
                    <h4>Clean now?</h4>
                    <p>The litter box runs a full cleaning cycle. Last clean: 14:05.</p>
                    <span className="lp-sheet-btn" data-primary="">
                      Clean
                    </span>
                    <span className="lp-sheet-btn">Cancel</span>
                  </div>
                  <div className="lp-toast" data-toast="">
                    <i />
                    Clean sent · MQTT · 0.2 s
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
