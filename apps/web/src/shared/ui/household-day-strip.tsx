import { useId, type ReactNode } from 'react';
import { formatMinute, leftAt, spanAt } from './day-strip-geometry';
import './household-day-strip.css';

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
  return <span className="ui-strip__now" style={{ left: leftAt(minute) }} aria-hidden="true" />;
}

/** Hatch drawn as an SVG pattern (never a gradient). */
function NoReportHatch({ span, patternId }: { span: DayStripSpan; patternId: string }) {
  const geo = spanAt(span.start, span.end);
  return (
    <svg className="ui-strip__hatch" style={geo} role="img" aria-label={span.title ?? 'No report'}>
      {span.title && <title>{span.title}</title>}
      <defs>
        <pattern
          id={patternId}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect className="ui-strip__hatch-line" width="1" height="5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

function LaneMarks({ lane, patternId }: { lane: DayStripLane; patternId: string }) {
  switch (lane.kind) {
    case 'pet':
      return lane.visits.map((v, i) => (
        <span
          key={`${v.minute}-${i}`}
          className={`ui-strip__visit ui-pet-ink-${petSlot(lane.petIndex)}`}
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
          className={m.fed ? 'ui-strip__meal ui-strip__meal--fed' : 'ui-strip__meal'}
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
            className="ui-strip__band"
            style={spanAt(s.start, s.end)}
            title={s.title}
            role="img"
            aria-label={s.title ?? `Reporting ${formatMinute(s.start)}–${formatMinute(s.end)}`}
          />
        ) : (
          <NoReportHatch key={`${s.start}-${i}`} span={s} patternId={`${patternId}-${i}`} />
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
  return (
    <div
      className={laneHeight === 28 ? 'ui-strip ui-strip--compact' : 'ui-strip'}
      role="group"
      aria-label={label}
    >
      <span />
      <div className="ui-strip__axis" aria-hidden="true">
        {AXIS.map(a => (
          <span
            key={a.label}
            className={`ui-strip__tick ui-strip__tick--${a.label}`}
            style={a.minute === 0 || a.minute === 1440 ? undefined : { left: leftAt(a.minute) }}
          >
            {a.label}
          </span>
        ))}
        {hasNow && (
          <span className="ui-strip__now-label" style={{ left: leftAt(nowMinute) }}>
            {nowLabel ?? formatMinute(nowMinute)}
          </span>
        )}
      </div>
      {lanes.map((lane, laneIndex) => (
        <div className="ui-strip__row" key={`${lane.kind}-${lane.id}`}>
          <span
            className={
              lane.kind === 'pet' ? 'ui-strip__name ui-strip__name--pet' : 'ui-strip__name'
            }
          >
            {lane.kind === 'pet' && lane.avatar}
            {lane.name}
          </span>
          <div
            className={
              lane.kind === 'fountain' ? 'ui-strip__lane ui-strip__lane--clip' : 'ui-strip__lane'
            }
          >
            <LaneMarks lane={lane} patternId={`${baseId}-${laneIndex}`} />
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
    <ul className="ui-strip-legend" aria-label="Legend">
      <li>
        <span className="ui-strip-legend__visit ui-pet-ink-0" aria-hidden="true" />
        Visit
      </li>
      <li>
        <span className="ui-strip-legend__meal ui-strip__meal--fed" aria-hidden="true" />
        Meal fed
      </li>
      <li>
        <span className="ui-strip-legend__meal" aria-hidden="true" />
        Meal planned
      </li>
      <li>
        <span className="ui-strip-legend__band" aria-hidden="true" />
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
              <rect className="ui-strip__hatch-line" width="1" height="4" />
            </pattern>
          </defs>
          <rect width="14" height="8" fill={`url(#${patternId})`} />
        </svg>
        No report
      </li>
    </ul>
  );
}
