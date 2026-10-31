import {
  DrawingFrame,
  levelFraction,
  STROKE,
  useSvgId,
  type DrawingLevel,
  type DrawingProps,
} from './drawing-frame';

/** Props for {@link LitterBoxDrawing}. */
export interface LitterBoxDrawingProps extends DrawingProps {
  /** Litter level in percent; missing draws an empty drum. */
  level: DrawingLevel;
}

/**
 * The litter-box drum: a sphere on a base, the litter filling its lower part, and the front
 * opening as an oval. Geometry from the iOS v3 artboards.
 */
export function LitterBoxDrawing({ level, ...frame }: LitterBoxDrawingProps) {
  const clip = useSvgId('drum');
  const fraction = levelFraction(level);
  // The litter surface rises from y=82 (empty) by up to 60% of the drum's 64px height.
  const top = fraction === null ? null : 82 - 64 * fraction * 0.6;
  return (
    <DrawingFrame {...frame}>
      <rect
        x="16"
        y="80"
        width="68"
        height="12"
        rx="6"
        strokeWidth="3"
        className={`fill-drawing-base ${STROKE}`}
      />
      <clipPath id={clip}>
        <circle cx="50" cy="46" r="34" />
      </clipPath>
      <circle cx="50" cy="46" r="34" className="fill-drawing-fill" />
      {top !== null && (
        <rect
          data-part="litter"
          x="10"
          y={top.toFixed(1)}
          width="80"
          height="60"
          clipPath={`url(#${clip})`}
          className="fill-litter"
        />
      )}
      <circle cx="50" cy="46" r="34" strokeWidth="3" className={`fill-none ${STROKE}`} />
      <ellipse
        cx="50"
        cy="50"
        rx="19"
        ry="15"
        fillOpacity=".55"
        strokeWidth="3"
        className={`fill-drawing-fill ${STROKE}`}
      />
    </DrawingFrame>
  );
}
