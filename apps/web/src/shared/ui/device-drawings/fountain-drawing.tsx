import {
  DrawingFrame,
  levelFraction,
  STROKE,
  useSvgId,
  type DrawingLevel,
  type DrawingProps,
} from './drawing-frame';

/** Props for {@link FountainDrawing}. */
export interface FountainDrawingProps extends DrawingProps {
  /** Water level in percent; missing draws an empty tank. */
  level: DrawingLevel;
}

/** The water fountain: a rounded tank with its spout, the water filling it to its level. */
export function FountainDrawing({ level, ...frame }: FountainDrawingProps) {
  const clip = useSvgId('tank');
  const fraction = levelFraction(level);
  // The water surface rises from y=82 (empty) by up to 50px.
  const top = fraction === null ? null : 82 - 50 * fraction;
  return (
    <DrawingFrame {...frame}>
      <clipPath id={clip}>
        <rect x="20" y="30" width="60" height="54" rx="14" />
      </clipPath>
      <rect x="20" y="30" width="60" height="54" rx="14" className="fill-drawing-fill" />
      {top !== null && (
        <rect
          data-part="water"
          x="20"
          y={top.toFixed(1)}
          width="60"
          height="60"
          clipPath={`url(#${clip})`}
          className="fill-water"
        />
      )}
      <rect
        x="20"
        y="30"
        width="60"
        height="54"
        rx="14"
        strokeWidth="3"
        className={`fill-none ${STROKE}`}
      />
      <path
        d="M50 30V16M42 16h16"
        strokeWidth="3"
        strokeLinecap="round"
        className={`fill-none ${STROKE}`}
      />
    </DrawingFrame>
  );
}
