import type { gsap as Gsap } from 'gsap';

type Selector = (selector: string) => Element[];

/**
 * Builds the scrubbed iOS walkthrough. Coordinates are in the screenshots' own
 * 390x844 points, so a re-taken screenshot means re-checking the tap targets:
 * litter-box card, Clean now, the sheet's Clean button, the Live view play
 * button, and the Timeline tab. Returns the timeline and the step labels in order.
 */
export function buildPhoneDemoTimeline(gsap: typeof Gsap, q: Selector) {
  const F = q('[data-finger]');
  const R = q('[data-ripple]');
  const page = (name: string) => q(`[data-page=${name}]`);
  const content = (name: string) => q(`[data-page=${name}] img`);
  const shade = (name: string) => q(`[data-shade=${name}]`);

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  gsap.set([F, R], { x: 230, y: 700 });
  gsap.set(q('[data-sheet]'), { y: 0, yPercent: 100 });
  gsap.set(q('[data-toast]'), { x: 0, xPercent: -50, y: -20 });
  gsap.set([page('t6'), page('live')], { x: 390, xPercent: 0 });

  const moveTo = (x: number, y: number, duration = 0.5) => tl.to(F, { x, y, duration });

  function tap(x: number, y: number) {
    moveTo(x, y);
    tl.to(F, { scale: 0.82, duration: 0.12 })
      .set(R, { x, y, scale: 0.6, opacity: 0.9 })
      .to(R, { scale: 1.9, opacity: 0, duration: 0.4, ease: 'power1.out' })
      .to(F, { scale: 1, duration: 0.12 }, '<');
  }

  // The finger drags while the page content scrolls by the same gesture
  function swipe(x: number, fromY: number, toY: number, pageName: string, scrollTo: number) {
    moveTo(x, fromY, 0.35);
    tl.to(F, { scale: 0.88, duration: 0.1 })
      .to(F, { y: toY, duration: 0.8, ease: 'power1.inOut' })
      .to(content(pageName), { y: scrollTo, duration: 1, ease: 'power2.out' }, '<')
      .to(F, { scale: 1, duration: 0.1 }, '-=.2');
  }

  // iOS navigation push: the new page slides in, the old one recedes and dims
  function push(from: string, to: string) {
    tl.to(page(to), { x: 0, duration: 0.55, ease: 'power3.out' })
      .to(page(from), { xPercent: -30, duration: 0.55, ease: 'power3.out' }, '<')
      .to(shade(from), { opacity: 0.15, duration: 0.55 }, '<');
  }

  // Interactive pop: a swipe from the left edge drags the top page away
  function edgeBack(top: string, under: string) {
    moveTo(10, 420, 0.3);
    tl.to(F, { scale: 0.88, duration: 0.1 })
      .to(F, { x: 330, duration: 0.55, ease: 'power2.in' })
      .to(page(top), { x: 390, duration: 0.55, ease: 'power2.in' }, '<')
      .to(page(under), { xPercent: 0, duration: 0.55, ease: 'power2.in' }, '<')
      .to(shade(under), { opacity: 0, duration: 0.55 }, '<')
      .to(F, { scale: 1, duration: 0.1 });
  }

  tl.addLabel('home').to(F, { opacity: 1, duration: 0.25 });
  swipe(260, 720, 520, 'home', -200);

  tl.addLabel('device');
  tap(100, 345);
  push('home', 't6');

  tl.addLabel('clean');
  tap(195, 469);
  tl.to(q('[data-sheet-bg]'), { opacity: 1, duration: 0.3 }).to(q('[data-sheet]'), { yPercent: 0, duration: 0.45, ease: 'power3.out' }, '<');
  tap(195, 718);
  tl.to(q('[data-sheet]'), { yPercent: 100, duration: 0.35, ease: 'power2.in' })
    .to(q('[data-sheet-bg]'), { opacity: 0, duration: 0.35 }, '<')
    .to(q('[data-toast]'), { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' })
    .to(q('[data-toast]'), { opacity: 0, y: -20, duration: 0.3 }, '+=.6');

  tl.addLabel('live');
  swipe(300, 700, 424, 't6', -276);
  tap(195, 641);
  push('t6', 'live');

  tl.addLabel('timeline');
  edgeBack('live', 't6');
  edgeBack('t6', 'home');
  tap(147, 800);
  tl.to(page('timeline'), { opacity: 1, duration: 0.2 }).set(page('home'), { opacity: 0 });
  swipe(260, 720, 444, 'timeline', -276);
  tl.to(F, { opacity: 0, duration: 0.3 });

  return { tl, labels: ['home', 'device', 'clean', 'live', 'timeline'] };
}
