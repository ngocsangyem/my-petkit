import {
  DrawingFrame,
  levelFraction,
  STROKE,
  type DrawingLevel,
  type DrawingProps,
} from './drawing-frame';

/** Props for {@link FeederDrawing}. */
export interface FeederDrawingProps extends DrawingProps {
  /**
   * Food level per hopper in percent: one entry draws a single wide window, two entries the dual
   * hopper. A missing entry draws that window empty.
   */
  levels: readonly DrawingLevel[];
}

const WINDOW_TOP = 22;
const WINDOW_HEIGHT = 34;

/** One hopper window, filled from the bottom to its level. */
function HopperWindow({ x, width, level }: { x: number; width: number; level: DrawingLevel }) {
  const fraction = levelFraction(level);
  const fill = fraction === null ? 0 : WINDOW_HEIGHT * fraction;
  return (
    <>
      <rect
        x={x}
        y={WINDOW_TOP}
        width={width}
        height={WINDOW_HEIGHT}
        rx="5"
        className="fill-drawing-fill"
      />
      {fill > 0 && (
        <rect
          data-part="food"
          x={x}
          y={(WINDOW_TOP + WINDOW_HEIGHT - fill).toFixed(1)}
          width={width}
          height={fill.toFixed(1)}
          rx="4"
          className="fill-food"
        />
      )}
      <rect
        x={x}
        y={WINDOW_TOP}
        width={width}
        height={WINDOW_HEIGHT}
        rx="5"
        strokeWidth="2.5"
        className={`fill-none ${STROKE}`}
      />
    </>
  );
}

/** The feeder: a body with one window per hopper whose fill is that hopper's level, on a tray. */
export function FeederDrawing({ levels, ...frame }: FeederDrawingProps) {
  const dual = levels.length > 1;
  return (
    <DrawingFrame {...frame}>
      <rect
        x="22"
        y="10"
        width="56"
        height="62"
        rx="12"
        strokeWidth="3"
        className={`fill-drawing-fill ${STROKE}`}
      />
      {dual ? (
        <>
          <HopperWindow x={27} width={20} level={levels[0]} />
          <HopperWindow x={53} width={20} level={levels[1]} />
        </>
      ) : (
        <HopperWindow x={30} width={40} level={levels[0]} />
      )}
      <path
        d="M18 80h64l-6 10H24z"
        strokeWidth="3"
        strokeLinejoin="round"
        className={`fill-drawing-base ${STROKE}`}
      />
    </DrawingFrame>
  );
}
