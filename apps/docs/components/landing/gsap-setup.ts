'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// One registration for every landing component; registering twice is harmless but noisy.
gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Pinned scenes start below the Fumadocs header so it never covers them.
export function navOffset() {
  const header = document.querySelector<HTMLElement>('#nd-nav, header');
  return header?.offsetHeight ?? 56;
}

export const WIDE = '(min-width: 901px)';
export const NARROW = '(max-width: 900px)';
