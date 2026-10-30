import type { ReactNode } from 'react';
import { Chip, PetAvatar } from '@/shared/ui';
import type { TimelineDevice, TimelinePet } from '../api';
import type { TimelineCounts } from '../timeline-model';
import { kindChips, type ViewFilter } from '../timeline-view-filter';

export interface TimelineFilterChipsProps {
  /** The server's counts for the current cat and device, before the kind chip is applied. */
  counts: TimelineCounts | undefined;
  /** Visits nobody was recognised in, for the current cat and device; undefined while loading. */
  unrecognised: number | undefined;
  view: ViewFilter;
  onView: (view: ViewFilter) => void;
  pets: readonly TimelinePet[];
  /** Pet id as a string; '' for every cat. */
  pet: string;
  onPet: (pet: string) => void;
  devices: readonly TimelineDevice[];
  /** Device id as a string; '' for every device. */
  device: string;
  onDevice: (device: string) => void;
}

/** A chip's count after its words, in the chip's own colour so it reads on the ink fill too. */
function Count({ value }: { value: number | null }) {
  return <span className="opacity-70">{value ?? '—'}</span>;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  );
}

/**
 * One row of chips: "All", then a chip per cat and per device, then the kinds with their counts,
 * light visits and the unrecognised ones last. The three families combine; a pressed cat or
 * device chip is pressed again to let go, and "All" clears every chip at once. Counts come from
 * the server before the kind chip is applied, so every chip keeps its total while another is on.
 */
export function TimelineFilterChips({
  counts,
  unrecognised,
  view,
  onView,
  pets,
  pet,
  onPet,
  devices,
  device,
  onDevice,
}: TimelineFilterChipsProps) {
  const everything = view === 'all' && pet === '' && device === '';
  // Two devices of one model would read alike; their id tells them apart.
  const duplicate = (name: string) => devices.filter(d => d.name === name).length > 1;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip
        pressed={everything}
        onPressedChange={() => {
          onView('all');
          onPet('');
          onDevice('');
        }}
      >
        All <Count value={counts ? counts.all : null} />
      </Chip>
      {pets.length > 0 && (
        <Group label="Filter by cat">
          {pets.map(p => {
            const id = String(p.id);
            return (
              <Chip
                key={id}
                className="pl-1.5"
                pressed={pet === id}
                onPressedChange={on => {
                  onPet(on ? id : '');
                }}
              >
                <PetAvatar photoUrl={p.faces[0]?.url} size={22} />
                {p.name}
              </Chip>
            );
          })}
        </Group>
      )}
      {devices.length > 0 && (
        <Group label="Filter by device">
          {devices.map(d => {
            const id = String(d.id);
            return (
              <Chip
                key={id}
                pressed={device === id}
                onPressedChange={on => {
                  onDevice(on ? id : '');
                }}
              >
                {d.name || `#${id}`}
                {duplicate(d.name) && <span className="opacity-70">#{id}</span>}
              </Chip>
            );
          })}
        </Group>
      )}
      <Group label="Filter by kind">
        {kindChips(counts, unrecognised, view).map(c => (
          <Chip
            key={c.key}
            pressed={view === c.key}
            onPressedChange={on => {
              onView(on ? c.key : 'all');
            }}
          >
            {c.label} <span aria-hidden="true">·</span> <Count value={c.count} />
          </Chip>
        ))}
      </Group>
    </div>
  );
}
