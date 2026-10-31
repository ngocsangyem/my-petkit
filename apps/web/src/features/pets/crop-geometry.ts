// Geometry of the face cropper: a fixed square frame with the photo panning
// and zooming underneath it, the way every avatar cropper works. A draggable,
// resizable box over a static photo needs corner handles, aspect locking and
// edge clamping, and is miserable on a touchscreen.

/**
 * The size the NPU is fed. Every face photo PetKit's own cloud served was
 * exactly this, and the server's `normalize_face_photo` returns an upload
 * byte-identical when it already is, so the crop the user makes is the one the
 * device gets.
 */
export const FACE_SIZE = 224;

/** Backing-store size of the working canvas; CSS scales it to the layout. */
export const STAGE_SIZE = 360;

/**
 * The zoom ceiling, as a multiple of "cover" rather than an absolute scale, so
 * it means the same for a 12 MP phone photo and a small crop. 8x pulls a face
 * out of a wide shot where the cat is a fifth of the frame.
 */
export const MAX_ZOOM = 8;

/** JPEG quality of the uploaded crop. */
export const JPEG_QUALITY = 0.92;

/** One wheel notch zooms by this factor. */
export const WHEEL_STEP = 1.12;

/**
 * What PetKit's own app tells its users: the conditions the matcher was tuned
 * for. A photo that breaks one costs accuracy on every future visit. The last
 * rule is a passport-photo joke kept from the old panel; nothing detects
 * eyewear and nothing should.
 */
export const FACE_RULES = [
  { ok: true, key: 'front' },
  { ok: true, key: 'wholeHead' },
  { ok: false, key: 'noSide' },
  { ok: false, key: 'noInfrared' },
  { ok: false, key: 'noBacklight' },
  { ok: false, key: 'uncovered' },
  { ok: false, key: 'oneCat' },
  { ok: false, key: 'noGlasses' },
] as const;

/** Where the photo sits under the frame, in stage pixels. */
export interface CropView {
  /** Natural size of the decoded photo. */
  width: number;
  height: number;
  /** Stage pixels per photo pixel. */
  scale: number;
  /** "Cover": the smallest scale at which the photo still fills the frame. */
  minScale: number;
  x: number;
  y: number;
}

/** The view that just covers the frame, centred. */
export function coverView(width: number, height: number, size = STAGE_SIZE): CropView {
  const minScale = Math.max(size / width, size / height);
  return clampView(
    {
      width,
      height,
      scale: minScale,
      minScale,
      x: (size - width * minScale) / 2,
      y: (size - height * minScale) / 2,
    },
    size,
  );
}

/**
 * Keep the photo covering the frame on every pan and zoom. Without this a drag
 * exposes the canvas background and the exported JPEG has a blank edge.
 */
export function clampView(view: CropView, size = STAGE_SIZE): CropView {
  const w = view.width * view.scale;
  const h = view.height * view.scale;
  return {
    ...view,
    x: Math.min(0, Math.max(size - w, view.x)),
    y: Math.min(0, Math.max(size - h, view.y)),
  };
}

/** Move the photo by a stage-pixel delta. */
export function panView(view: CropView, dx: number, dy: number, size = STAGE_SIZE): CropView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

/**
 * Zoom about a point (the cursor for a wheel, the centre for the slider) so
 * the thing being looked at stays put instead of sliding away.
 */
export function zoomView(
  view: CropView,
  scale: number,
  ax: number,
  ay: number,
  size = STAGE_SIZE,
): CropView {
  const next = Math.max(view.minScale, Math.min(view.minScale * MAX_ZOOM, scale));
  const ratio = next / view.scale;
  return clampView(
    {
      ...view,
      scale: next,
      x: ax - (ax - view.x) * ratio,
      y: ay - (ay - view.y) * ratio,
    },
    size,
  );
}

/** The zoom as the slider shows it: 100 at cover, 800 at the ceiling. */
export function zoomPercent(view: CropView): number {
  return Math.round((view.scale / view.minScale) * 100);
}

/** The draw rectangle of the photo on a canvas `target` pixels wide. */
export function drawRect(
  view: CropView,
  target: number,
  size = STAGE_SIZE,
): { x: number; y: number; w: number; h: number } {
  const k = target / size;
  return {
    x: view.x * k,
    y: view.y * k,
    w: view.width * view.scale * k,
    h: view.height * view.scale * k,
  };
}
