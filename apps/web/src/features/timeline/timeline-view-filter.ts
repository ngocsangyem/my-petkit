// The kind chips of the Timeline: the server's filter buckets plus "Not recognised", which the
// server has no bucket for and is narrowed here from the unfiltered day. Pure, no network.
import {
  FILTERS,
  type FilterKey,
  type TimelineCounts,
  type TimelineSession,
} from './timeline-model';

/** A chip of the kind row: a server bucket, or the visits nobody was recognised in. */
export type ViewFilter = FilterKey | 'unrecognised';

export const UNRECOGNISED_LABEL = 'Not recognised';

/** What the server is asked for: "Not recognised" narrows the unfiltered day. */
export function serverFilter(view: ViewFilter): FilterKey {
  return view === 'unrecognised' ? 'all' : view;
}

/**
 * A litter-box visit the camera put no name to and that is not "just passing". Light visits are
 * never in the unfiltered day, so they are never counted here either.
 */
export function isUnrecognisedVisit(s: TimelineSession): boolean {
  return s.kind === 'visit' && s.pet_id === null && !s.passing;
}

/** The sessions a chip shows, from what the server answered for {@link serverFilter}. */
export function applyViewFilter(
  sessions: readonly TimelineSession[],
  view: ViewFilter,
): TimelineSession[] {
  return view === 'unrecognised' ? sessions.filter(isUnrecognisedVisit) : [...sessions];
}

export interface KindChip {
  key: ViewFilter;
  label: string;
  /** Null while the day is loading. */
  count: number | null;
}

/**
 * The kind chips after "All", in the legacy order with "Not recognised" last. A chip with
 * nothing in it is shown only while it is the selected one, so a family that produced nothing
 * adds no permanent zero and a selected empty chip can still be left.
 */
export function kindChips(
  counts: TimelineCounts | undefined,
  unrecognised: number | undefined,
  selected: ViewFilter,
): KindChip[] {
  const chips: KindChip[] = FILTERS.filter(f => f.key !== 'all').map(f => ({
    key: f.key,
    label: f.label,
    count: counts ? counts[f.key] : null,
  }));
  chips.push({ key: 'unrecognised', label: UNRECOGNISED_LABEL, count: unrecognised ?? null });
  return chips.filter(c => c.key === selected || (c.count ?? 0) > 0);
}
