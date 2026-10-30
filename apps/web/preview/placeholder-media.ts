// Neutral stand-ins for the pictures a real server would serve: pet face photos
// and timeline stills. The design's cat photos are never shipped (one is
// CC BY-SA), so the preview build writes these small SVGs instead, at exactly
// the paths the fixtures hand to the screens. Read by both the fixtures (for the
// URLs) and the preview's Vite config (to emit the files).

export interface Placeholder {
  /** Path relative to the server root, as the API would return it. */
  path: string;
  /** Characters drawn in the middle; empty for a still, which sits under captions. */
  mark: string;
  /** Hue of the tint, so two pets never look alike. */
  hue: number;
}

/** A face photo of pet `petId`; the URL the API returns for it. */
export const faceUrl = (petId: number, faceId: number) =>
  `preview-media/pets/${petId}/faces/${faceId}.svg`;

/** A timeline still; `mediaUrl()` serves it under `api/media/thumb/`. */
export const stillPath = (name: string) => `preview/${name}.svg`;

const MISO_HUE = 212;
const MOCHI_HUE = 38;
const STILL_HUE = 170;

export const PLACEHOLDERS: readonly Placeholder[] = [
  { path: faceUrl(1, 11), mark: 'M', hue: MISO_HUE },
  { path: faceUrl(1, 12), mark: 'M', hue: MISO_HUE },
  { path: faceUrl(1, 13), mark: 'M', hue: MISO_HUE },
  { path: faceUrl(2, 21), mark: 'Mo', hue: MOCHI_HUE },
  { path: `api/media/thumb/${stillPath('miso-1358')}`, mark: '', hue: STILL_HUE },
  { path: `api/media/${stillPath('miso-1358')}`, mark: '', hue: STILL_HUE },
  { path: `api/media/thumb/${stillPath('waste-1358')}`, mark: '', hue: STILL_HUE },
  { path: `api/media/${stillPath('waste-1358')}`, mark: '', hue: STILL_HUE },
];

/** The SVG for one placeholder: a tinted square with its mark, no external refs. */
export function placeholderSvg(p: Placeholder): string {
  const size = p.mark.length > 2 ? 28 : 64;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">` +
    `<rect width="256" height="256" fill="hsl(${p.hue} 35% 88%)"/>` +
    `<text x="128" y="128" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="sans-serif" font-size="${size}" fill="hsl(${p.hue} 45% 30%)">${p.mark}</text>` +
    `</svg>`
  );
}
