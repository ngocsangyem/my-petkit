import { useId, type ReactNode } from 'react';
import { cn } from 'cn';
import { formatMinute, leftAt, spanAt } from './day-strip-geometry';

/** A litter-box visit by one pet, at minutes since the device's local midnight. */
export interface DayStripVisit {
  minute: number;
  /** Tooltip and accessible text, e.g. "01:12 · 2 min 10 s · 5.41 kg". */
  title?: string;
}

/** A meal on the feeder lane: filled when fed, outlined when planned. */
export interface DayStripMeal {
  minute: number;
  fed: boolean;
  title?: string;
}

/** A span on the fountain lane: `reporting` band, or `no-report` red hatch. */
export interface DayStripSpan {
  start: number;
  end: number;
  state: 'reporting' | 'no-report';
  title?: string;
}

/** One lane per pet, plus feeder and fountain lanes. */
export type DayStripLane =
  | {
      kind: 'pet';
      id: string;
      name: string;
      /** Pet index in the household; picks the identity ink (cycles through the pet tokens). */
      petIndex: number;
      /** Optional 24px round photo; decorative. */
      avatar?: ReactNode;
      visits: readonly DayStripVisit[];
    }
  | { kind: 'feeder'; id: string; name: string; meals: readonly DayStripMeal[] }
  | { kind: 'fountain'; id: string; name: string; spans: readonly DayStripSpan[] };

/** Number of pet identity tints defined in tokens.css. */
export const PET_TINT_COUNT = 2;

/** Identity slot for a pet index (0-based), cycling through the defined tints. */
export function petSlot(index: number): number {
  const i = Number.isFinite(index) ? Math.trunc(Math.abs(index)) : 0;
  return i % PET_TINT_COUNT;
}

/** Props for {@link HouseholdDayStrip}. */
export interface HouseholdDayStripProps {
  lanes: readonly DayStripLane[];
  /** Minutes since the device's local midnight for "now"; omit for a past day. */
  nowMinute?: number | null;
  /** Label above the now line; defaults to HH:MM of `nowMinute`. */
  nowLabel?: string;
  /** Lane height: 32 on the devices screen, 28 on the design sheet. */
  laneHeight?: 28 | 32;
  /** Accessible name, e.g. "Today at home, Tue 28 Oct". */
  label: string;
}

/** Identity ink per pet slot; `ui-pet-ink-<slot>` stays as a hook for tests. */
const PET_INK = ['text-(--pk-pet-0-ink)', 'text-(--pk-pet-1-ink)'] as const;

function petInk(index: number): string {
  const slot = petSlot(index);
  return cn(`ui-pet-ink-${slot}`, PET_INK[slot]);
}

/** Lane height and the top offset of each mark, so marks stay centred in a 32 or 28px lane. */
const LANE = {
  32: { lane: 'h-8', visit: 'top-2', meal: 'top-3', band: 'top-2.5' },
  28: { lane: 'h-7', visit: 'top-1.5', meal: 'top-2.5', band: 'top-2' },
} as const;

type LaneGeometry = (typeof LANE)[keyof typeof LANE];

/** `useId` output made safe inside an SVG `url(#…)` reference. */
function svgSafeId(id: string): string {
  return `strip${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

const AXIS = [
  { label: '00', minute: 0 },
  { label: '06', minute: 360 },
  { label: '12', minute: 720 },
  { label: '18', minute: 1080 },
  { label: '24', minute: 1440 },
];

function NowLine({ minute }: { minute: number | null | undefined }) {
  if (minute === null || minute === undefined) return null;
  return (
    <span
      className="ui-strip__now pointer-events-none absolute inset-y-0 w-px bg-data"
      style={{ left: leftAt(minute) }}
      aria-hidden="true"
    />
  );
}

/** Hatch drawn as an SVG pattern (never a gradient). */
function NoReportHatch({
  span,
  patternId,
  top,
}: {
  span: DayStripSpan;
  patternId: string;
  top: string;
}) {
  const geo = spanAt(span.start, span.end);
  return (
    <svg
      className={cn('absolute h-3', top)}
      style={geo}
      role="img"
      aria-label={span.title ?? 'No report'}
    >
      {span.title && <title>{span.title}</title>}
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect className="fill-negative" width="1" height="5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

function LaneMarks({
  lane,
  patternId,
  geometry,
}: {
  lane: DayStripLane;
  patternId: string;
  geometry: LaneGeometry;
}) {
  switch (lane.kind) {
    case 'pet':
      return lane.visits.map((v, i) => (
        <span
          key={`${v.minute}-${i}`}
          className={cn(
            'absolute h-4 w-[3px] rounded-[1px] bg-current',
            geometry.visit,
            petInk(lane.petIndex),
          )}
          style={{ left: leftAt(v.minute) }}
          title={v.title}
          role="img"
          aria-label={v.title ?? `Visit at ${formatMinute(v.minute)}`}
        />
      ));
    case 'feeder':
      return lane.meals.map((m, i) => (
        <span
          key={`${m.minute}-${i}`}
          className={cn(
            'absolute size-2 border-[1.5px] border-foreground',
            geometry.meal,
            m.fed ? 'ui-strip__meal--fed bg-foreground' : 'bg-background',
          )}
          style={{ left: leftAt(m.minute) }}
          title={m.title}
          role="img"
          aria-label={m.title ?? `${m.fed ? 'Fed' : 'Planned'} at ${formatMinute(m.minute)}`}
        />
      ));
    case 'fountain':
      return lane.spans.map((s, i) =>
        s.state === 'reporting' ? (
          <span
            key={`${s.start}-${i}`}
            className={cn('absolute h-3 bg-(--pk-fountain-reporting)', geometry.band)}
            style={spanAt(s.start, s.end)}
            title={s.title}
            role="img"
            aria-label={s.title ?? `Reporting ${formatMinute(s.start)}–${formatMinute(s.end)}`}
          />
        ) : (
          <NoReportHatch
            key={`${s.start}-${i}`}
            span={s}
            patternId={`${patternId}-${i}`}
            top={geometry.band}
          />
        ),
      );
  }
}

/**
 * The 24-hour household strip: a lane per pet (visit ticks in the pet's ink), the feeder (meal
 * squares) and the fountain (reporting band, then a red hatch). Positions come from minutes since
 * midnight that the caller computed in the device's timezone; this component never reads a clock.
 */
export function HouseholdDayStrip({
  lanes,
  nowMinute,
  nowLabel,
  laneHeight = 32,
  label,
}: HouseholdDayStripProps) {
  const baseId = svgSafeId(useId());
  const hasNow = nowMinute !== null && nowMinute !== undefined;
  const geometry = LANE[laneHeight];
  return (
    <div
      className="ui-strip grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 min-[901px]:grid-cols-[120px_minmax(0,1fr)]"
      role="group"
      aria-label={label}
    >
      <span />
      <div className="relative h-[18px] text-xs text-muted-foreground" aria-hidden="true">
        {AXIS.map(a => (
          <span
            key={a.label}
            className={cn(
              'absolute top-0',
              a.minute === 0 && 'left-0',
              a.minute === 1440 && 'right-0',
              a.minute > 0 && a.minute < 1440 && '-translate-x-1/2',
            )}
            style={a.minute === 0 || a.minute === 1440 ? undefined : { left: leftAt(a.minute) }}
          >
            {a.label}
          </span>
        ))}
        {hasNow && (
          <span
            className="ui-strip__now-label absolute top-0 -translate-x-1/2 bg-background px-1 font-semibold text-data"
            style={{ left: leftAt(nowMinute) }}
          >
            {nowLabel ?? formatMinute(nowMinute)}
          </span>
        )}
      </div>
      {lanes.map((lane, laneIndex) => (
        <div className="contents" key={`${lane.kind}-${lane.id}`}>
          <span
            className={cn(
              'min-w-0 truncate',
              lane.kind === 'pet'
                ? 'flex items-center gap-2 font-medium text-foreground [&_img]:size-6 [&_img]:flex-none [&_img]:rounded-full [&_img]:object-cover'
                : 'text-muted-foreground',
            )}
          >
            {lane.kind === 'pet' && lane.avatar}
            {lane.name}
          </span>
          <div
            className={cn(
              'relative rounded-sm bg-raised',
              geometry.lane,
              lane.kind === 'fountain' && 'overflow-hidden',
            )}
          >
            <LaneMarks lane={lane} patternId={`${baseId}-${laneIndex}`} geometry={geometry} />
            <NowLine minute={nowMinute} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Legend for the strip, drawn with the marks themselves; place it in the section header. */
export function DayStripLegend() {
  const patternId = `${svgSafeId(useId())}-legend`;
  return (
    <ul
      className="m-0 flex list-none flex-wrap items-center gap-4 p-0 text-xs text-muted-foreground max-[901px]:hidden [&>li]:inline-flex [&>li]:items-center [&>li]:gap-1.5"
      aria-label="Legend"
    >
      <li>
        <span className={cn('h-3 w-[3px] bg-current', petInk(0))} aria-hidden="true" />
        Visit
      </li>
      <li>
        <span
          className="size-2 border-[1.5px] border-foreground bg-foreground"
          aria-hidden="true"
        />
        Meal fed
      </li>
      <li>
        <span className="size-2 border-[1.5px] border-foreground" aria-hidden="true" />
        Meal planned
      </li>
      <li>
        <span className="h-2 w-3.5 bg-(--pk-fountain-reporting)" aria-hidden="true" />
        Reporting
      </li>
      <li>
        <svg width="14" height="8" aria-hidden="true">
          <defs>
            <pattern
              id={patternId}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect className="fill-negative" width="1" height="4" />
            </pattern>
          </defs>
          <rect width="14" height="8" fill={`url(#${patternId})`} />
        </svg>
        No report
      </li>
    </ul>
  );
}
