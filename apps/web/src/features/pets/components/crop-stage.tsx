import {
  useEffect,
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  drawRect,
  FACE_SIZE,
  panView,
  STAGE_SIZE,
  WHEEL_STEP,
  zoomView,
  type CropView,
} from '../crop-geometry';
import type { CropSource } from '../decode-image';
import { CropGuide } from './crop-guide';

interface CropStageProps {
  source: CropSource;
  view: CropView;
  setView: Dispatch<SetStateAction<CropView | null>>;
  /** The 224x224 canvas that becomes the upload; drawn here with the same transform. */
  previewRef: RefObject<HTMLCanvasElement | null>;
}

const KEY_PAN = 12;

function paint(canvas: HTMLCanvasElement | null, source: CropSource, view: CropView): void {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const r = drawRect(view, canvas.width);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, r.x, r.y, r.w, r.h);
}

/** The working canvas with the guide over it, and the device-size preview beside it. */
export function CropStage({ source, view, setView, previewRef }: CropStageProps) {
  const stage = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // The preview is the same transform at the size the device receives, so what
  // it shows is literally the bytes that get uploaded.
  useEffect(() => {
    paint(stage.current, source, view);
    paint(previewRef.current, source, view);
  }, [source, view, previewRef]);

  // The canvas is drawn at its backing-store size but laid out by CSS, so a
  // pointer pixel is a canvas pixel only after scaling by the ratio.
  const stageRatio = (): number => {
    const canvas = stage.current;
    const width = canvas?.getBoundingClientRect().width ?? 0;
    return canvas && width > 0 ? canvas.width / width : 1;
  };

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const canvas = stage.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const k = rect.width > 0 ? canvas.width / rect.width : 1;
      const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      setView(v =>
        v
          ? zoomView(
              v,
              v.scale * factor,
              (event.clientX - rect.left) * k,
              (event.clientY - rect.top) * k,
            )
          : v,
      );
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [setView]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: event.clientX, y: event.clientY };
    // Capture keeps the drag tracked when the pointer leaves the canvas mid-drag.
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = drag.current;
    if (!from) return;
    const k = stageRatio();
    const dx = (event.clientX - from.x) * k;
    const dy = (event.clientY - from.y) * k;
    drag.current = { x: event.clientX, y: event.clientY };
    setView(v => (v ? panView(v, dx, dy) : v));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const centre = STAGE_SIZE / 2;
    const moves: Record<string, (v: CropView) => CropView> = {
      ArrowLeft: v => panView(v, -KEY_PAN, 0),
      ArrowRight: v => panView(v, KEY_PAN, 0),
      ArrowUp: v => panView(v, 0, -KEY_PAN),
      ArrowDown: v => panView(v, 0, KEY_PAN),
      '+': v => zoomView(v, v.scale * WHEEL_STEP, centre, centre),
      '=': v => zoomView(v, v.scale * WHEEL_STEP, centre, centre),
      '-': v => zoomView(v, v.scale / WHEEL_STEP, centre, centre),
    };
    const move = Object.hasOwn(moves, event.key) ? moves[event.key] : undefined;
    if (!move) return;
    event.preventDefault();
    setView(v => (v ? move(v) : v));
  };

  return (
    <div className="pets-crop-work">
      <div
        className="pets-crop-stage"
        role="group"
        tabIndex={0}
        aria-label="Photo under the crop frame. Drag or use the arrow keys to move it; plus and minus zoom."
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={stage}
          width={STAGE_SIZE}
          height={STAGE_SIZE}
          className="pets-crop-stage__canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        <CropGuide />
      </div>
      <figure className="pets-crop-preview">
        <figcaption>What the device sees</figcaption>
        <canvas
          ref={previewRef}
          width={FACE_SIZE}
          height={FACE_SIZE}
          className="pets-crop-preview__canvas"
          aria-label={`The ${FACE_SIZE} by ${FACE_SIZE} crop that will be uploaded`}
          role="img"
        />
      </figure>
    </div>
  );
}
