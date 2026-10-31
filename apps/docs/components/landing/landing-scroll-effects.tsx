'use client';

import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from './gsap-setup';

/**
 * Page-wide effects driven by data attributes, so the static sections stay server
 * components: [data-lp-reveal] children rise in, [data-lp-count] numbers count up,
 * [data-lp-scale-in] grows into place, [data-lp-magnet] buttons follow the pointer.
 * Rendered last on the page so its triggers are created after every pin above them.
 */
export function LandingScrollEffects() {
  useGSAP(() => {
    if (prefersReducedMotion()) return;

    gsap.utils.toArray<HTMLElement>('[data-lp-reveal]').forEach((group) =>
      gsap.from(group.children, { y: 36, opacity: 0.2, stagger: 0.08, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: group, start: 'top 88%' } }),
    );

    gsap.utils.toArray<HTMLElement>('[data-lp-count]').forEach((el) => {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: Number(el.dataset.lpCount),
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onUpdate: () => {
          el.textContent = String(Math.round(counter.v));
        },
      });
    });

    gsap.utils.toArray<HTMLElement>('[data-lp-scale-in]').forEach((el) =>
      gsap.from(el, { scale: 0.94, borderRadius: 48, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 50%', scrub: 0.6 } }),
    );

    const cleanups: (() => void)[] = [];
    if (window.matchMedia('(hover: hover)').matches) {
      gsap.utils.toArray<HTMLElement>('[data-lp-magnet]').forEach((btn) => {
        const move = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.3, ease: 'power3.out' });
        };
        const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, .4)' });
        btn.addEventListener('pointermove', move);
        btn.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          btn.removeEventListener('pointermove', move);
          btn.removeEventListener('pointerleave', leave);
        });
      });
    }

    // Screenshots change section heights once they load; recompute pin spacing then
    const refresh = () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    };
    ScrollTrigger.sort();
    window.addEventListener('load', refresh);
    return () => {
      window.removeEventListener('load', refresh);
      cleanups.forEach((fn) => fn());
    };
  });

  return null;
}
