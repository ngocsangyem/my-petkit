import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Missing, Panel } from '@/shared/ui';
import {
  clockTime,
  hasMedia,
  splitFact,
  subEventLabel,
  type TimelineSession,
} from '../timeline-model';
import { PetSourceTag } from './pet-source-tag';

/** When the cat entered and left, from the visit's start and length; `left` is null if unknown. */
function visitSpan(s: TimelineSession): { entered: number | null; left: number | null } {
  const entered = s.display_ts ?? s.ts;
  const left =
    s.kind === 'visit' && entered !== null && s.duration_sec !== null
      ? entered + s.duration_sec
      : null;
  return { entered, left };
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3.5 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-lg tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * A visit's four figures in the split panel: when, how long, the reading and the cat, with how
 * the cat was decided beside its name.
 */
export function SessionFigures({
  session: s,
  duration,
  weight,
}: {
  session: TimelineSession;
  duration: string | null;
  weight: string | null;
}) {
  const { entered, left } = visitSpan(s);
  const range = [clockTime(entered), left !== null ? clockTime(left) : null]
    .filter(Boolean)
    .join(' – ');
  return (
    <Panel padding="none">
      <dl className="m-0 grid grid-cols-2 [&>*:nth-child(n+3)]:border-t [&>*:nth-child(odd)]:border-r [&>*]:border-segment">
        <Figure label="Time">{range || <Missing />}</Figure>
        <Figure label="Duration">{duration ?? <Missing />}</Figure>
        <Figure label="Weight">{weight ?? <Missing />}</Figure>
        <Figure label="Matched">
          {s.pet_name ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {s.pet_name}
              <PetSourceTag session={s} />
            </span>
          ) : (
            <span className="text-muted-foreground">
              {s.passing ? 'No cat, just passing' : 'Nobody recognised'}
            </span>
          )}
        </Figure>
      </dl>
    </Panel>
  );
}

function Row({
  label,
  muted,
  children,
}: {
  label: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-t border-rule py-1.5 first:border-t-0">
      <dt
        className={cn(
          'inline-flex min-w-0 flex-wrap items-baseline gap-2',
          muted && 'text-sm text-muted-foreground',
        )}
      >
        {label}
      </dt>
      <dd className="m-0 text-right tabular-nums">{children}</dd>
    </div>
  );
}

export interface SessionFactsProps {
  session: TimelineSession;
  /** The step whose media the viewer shows, or null for the session's own. */
  stepMedia: number | null;
  onStepMedia: (stepId: number) => void;
}

/**
 * Every fact about the session as rows split by a rule: entered and left to the second, each step
 * (a step with media can be shown in the viewer), what the box reported, and the device.
 */
export function SessionFacts({ session: s, stepMedia, onStepMedia }: SessionFactsProps) {
  const isVisit = s.kind === 'visit';
  const { entered, left } = visitSpan(s);
  return (
    <dl className="m-0 flex flex-col">
      <Row label={isVisit ? 'Entered' : 'At'}>{clockTime(entered, true) ?? <Missing />}</Row>
      {left !== null && <Row label="Left">{clockTime(left, true) ?? <Missing />}</Row>}
      {s.sub_events.map((e, i) => (
        <Row
          key={e.id ?? `s${String(i)}`}
          muted={e.detail}
          label={
            <>
              {subEventLabel(e)}
              {e.id !== null && hasMedia(e.media) && (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-data focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:underline"
                  aria-pressed={stepMedia === e.id}
                  onClick={() => {
                    if (e.id !== null) onStepMedia(e.id);
                  }}
                >
                  Show media
                </button>
              )}
            </>
          }
        >
          {clockTime(e.ts, true) ?? <Missing />}
        </Row>
      ))}
      {s.bits.map(b => {
        const f = splitFact(b);
        return (
          <Row key={b} label={f.label.charAt(0).toUpperCase() + f.label.slice(1)}>
            {f.value ?? 'yes'}
          </Row>
        );
      })}
      {s.device_name && <Row label="Device">{s.device_name}</Row>}
    </dl>
  );
}
