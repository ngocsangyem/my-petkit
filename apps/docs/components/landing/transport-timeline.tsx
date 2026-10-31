'use client';

import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from './gsap-setup';
import { SectionHead } from './section-head';

const MONO = 'IBM Plex Mono, monospace';
// Illustrative heartbeat ticks up to where HTTP went quiet on the T5 (about 40 s after CONNECT)
const BEATS = Array.from({ length: 12 }, (_, i) => 110 + i * 42);

/** HTTP first, then MQTT: a playhead scrubbed by scroll across the observed transport switch. */
export function TransportTimeline() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (prefersReducedMotion()) {
        gsap.set(q('[data-playhead]'), { attr: { x1: 880, x2: 880 } });
        gsap.set(q('[data-mqtt]'), { strokeDashoffset: 0 });
        return;
      }
      gsap
        .timeline({ scrollTrigger: { trigger: q('svg')[0], start: 'top 75%', end: 'bottom 35%', scrub: 0.5 } })
        .fromTo(q('[data-playhead]'), { attr: { x1: 90, x2: 90 } }, { attr: { x1: 880, x2: 880 }, ease: 'none', duration: 1 }, 0)
        .to(q('[data-mqtt]'), { strokeDashoffset: 0, ease: 'none', duration: 0.66 }, 0.34)
        .from(q('[data-beat]'), { scaleY: 0, transformOrigin: '50% 50%', stagger: 0.045, duration: 0.05 }, 0);
    },
    { scope: root },
  );

  return (
    <section className="lp-block lp-block-tight" ref={root}>
      <div className="lp-wrap">
        <SectionHead eyebrow="HTTP first, then MQTT" title="The heartbeat goes quiet. That's the good sign.">
          A device always starts on HTTP, because that&apos;s where it signs up. Once it reaches the broker it stops
          polling. On a real T5 the HTTP side went silent about 40 seconds after the MQTT connection opened, and
          commands started arriving the moment you flip a control.
        </SectionHead>
        <div className="lp-transport">
          <svg viewBox="0 0 900 220" role="img" aria-label="Timeline: HTTP heartbeats until about 40 seconds after MQTT connects, then MQTT only">
            <g fontFamily={MONO} fontSize="12" fill="var(--lp-muted)">
              <text x="0" y="66">HTTP</text>
              <text x="0" y="146">MQTT</text>
              <text x="90" y="206">0 s</text>
              <text x="330" y="206">CONNECT</text>
              <text x="590" y="206">+40 s</text>
              <text x="840" y="206">later</text>
            </g>
            <line x1="90" y1="60" x2="880" y2="60" stroke="var(--lp-rule)" strokeWidth="2" />
            <line x1="90" y1="140" x2="880" y2="140" stroke="var(--lp-rule)" strokeWidth="2" />
            {BEATS.map((x) => (
              <rect key={x} data-beat="" x={x} y="48" width="6" height="24" rx="3" fill="var(--lp-ink)" />
            ))}
            <rect x="350" y="126" width="530" height="28" rx="14" fill="var(--lp-accent-soft)" />
            <line data-mqtt="" x1="350" y1="140" x2="880" y2="140" stroke="var(--lp-accent)" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
            <line x1="350" y1="30" x2="350" y2="186" stroke="var(--lp-accent)" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1="610" y1="30" x2="610" y2="186" stroke="var(--lp-muted)" strokeWidth="1.5" strokeDasharray="3 4" />
            <text x="618" y="40" fontSize="13" fill="var(--lp-muted)">
              HTTP heartbeat stops
            </text>
            <line data-playhead="" x1="90" y1="22" x2="90" y2="190" stroke="var(--lp-ink)" strokeWidth="2" />
          </svg>
          <div className="lp-legend">
            <span>Observed on a Purobot Max Pro 2 (T5). Tick spacing is illustrative.</span>
            <span>Camera models need the MQTT TLS Bypass patcher to get here.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
