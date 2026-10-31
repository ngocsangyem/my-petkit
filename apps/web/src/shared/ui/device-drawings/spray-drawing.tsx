import { DrawingFrame, STROKE, type DrawingProps } from './drawing-frame';

/** Props for {@link SprayDrawing}. */
export type SprayDrawingProps = DrawingProps;

/** The Pura Air spray: a tall capsule with its nozzle. It reports no level. */
export function SprayDrawing(frame: SprayDrawingProps) {
  return (
    <DrawingFrame {...frame}>
      <rect
        x="34"
        y="18"
        width="32"
        height="68"
        rx="16"
        strokeWidth="3"
        className={`fill-drawing-fill ${STROKE}`}
      />
      <circle cx="50" cy="38" r="6" strokeWidth="3" className={`fill-none ${STROKE}`} />
    </DrawingFrame>
  );
}
