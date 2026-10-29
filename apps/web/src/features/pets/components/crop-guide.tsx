import { useId } from 'react';

/** The marks' two layers, dark under light, so they read on a black cat and on a white one. */
const MARK_LAYERS = [
  'fill-none stroke-ink stroke-[1.6] opacity-55 [stroke-linecap:round] [stroke-linejoin:round]',
  'fill-none stroke-on-dark stroke-[0.8] [stroke-linecap:round] [stroke-linejoin:round]',
] as const;

/**
 * Alignment guide over the crop stage. The device is fed a 224x224 face chip,
 * and every reference photo PetKit's own cloud served was cropped that
 * tightly, so "a photo of the cat" is the wrong instinct and the outline is
 * here to correct it before the upload rather than after.
 *
 * The viewBox is tighter than the artwork (drawn on 0..100), so the head runs
 * off the frame instead of stopping politely inside it: anything short of "the
 * head fills the frame" wastes most of the pixels the NPU gets.
 */
export function CropGuide() {
  const maskId = useId();
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="5 4 90 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <mask id={maskId}>
        {/*
          Mask luminance, not visible colours: white keeps the dimming layer, black cuts
          the head out of it. Keywords rather than tokens because a mask reads brightness only.
        */}
        <rect fill="white" width="100" height="100" />
        <path
          fill="black"
          d="M50 98 C25 98 4 82 4 60 C4 50 6 40 8 32 L12 3 L36 22 C44 19 56 19 64 22 L88 3 L92 32 C94 40 96 50 96 60 C96 82 75 98 50 98 Z"
        />
      </mask>
      <rect className="fill-backdrop" width="100" height="100" mask={`url(#${maskId})`} />
      {/*
        Eyes, nose and whiskers as outlines over the cutout: filled shapes sat on
        the cat's own eyes and hid the feature the photo is lined up by. Drawn
        twice, dark under light, so they stay legible on a black cat and a white one.
      */}
      {MARK_LAYERS.map(layer => (
        <g key={layer} className={layer}>
          <circle cx="33" cy="50" r="4.5" />
          <circle cx="67" cy="50" r="4.5" />
          <path d="M45 63 L55 63 L50 70 Z" />
          <path d="M50 70 q -5 7 -10 2 M50 70 q 5 7 10 2" />
          <path d="M39 68 L9 61 M38 73 L7 73 M39 78 L9 85" />
          <path d="M61 68 L91 61 M62 73 L93 73 M61 78 L91 85" />
        </g>
      ))}
    </svg>
  );
}
