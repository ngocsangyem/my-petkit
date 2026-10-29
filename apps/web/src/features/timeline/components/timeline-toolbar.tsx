import { Icon, InlineField, Select, type SelectOption } from '@/shared/ui';
import { Button } from '@/shared/ui/shadcn/button';
import { Input } from '@/shared/ui/shadcn/input';
import type { TimelineDevice, TimelinePet } from '../api';
import { isDateString, shiftDay, todayLocal } from '../timeline-model';

export interface TimelineToolbarProps {
  date: string;
  onDate: (date: string) => void;
  pet: string;
  onPet: (pet: string) => void;
  device: string;
  onDevice: (device: string) => void;
  pets: readonly TimelinePet[];
  devices: readonly TimelineDevice[];
}

/** Day picker (previous, date, next), then the cat and device filters. */
export function TimelineToolbar({
  date,
  onDate,
  pet,
  onPet,
  device,
  onDevice,
  pets,
  devices,
}: TimelineToolbarProps) {
  const today = todayLocal();
  const petOptions: SelectOption[] = [
    { value: '', label: 'All cats' },
    ...pets.map(p => ({ value: String(p.id), label: p.name })),
  ];
  const deviceOptions: SelectOption[] = [
    { value: '', label: 'All devices' },
    ...devices.map(d => ({ value: String(d.id), label: `${d.name} #${String(d.id)}` })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={() => {
          onDate(shiftDay(date, -1));
        }}
      >
        <Icon name="chevron" className="rotate-90" />
      </Button>
      <InlineField label="Date">
        <Input
          type="date"
          className="w-auto"
          value={date}
          max={today}
          onChange={e => {
            if (isDateString(e.target.value)) onDate(e.target.value);
          }}
        />
      </InlineField>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => {
          onDate(shiftDay(date, 1));
        }}
      >
        <Icon name="chevron" className="-rotate-90" />
      </Button>
      <span className="w-2" />
      {pets.length > 0 && (
        <InlineField label="Cat">
          <Select
            options={petOptions}
            value={pet}
            onChange={e => {
              onPet(e.target.value);
            }}
          />
        </InlineField>
      )}
      <InlineField label="Device">
        <Select
          options={deviceOptions}
          value={device}
          onChange={e => {
            onDevice(e.target.value);
          }}
        />
      </InlineField>
    </div>
  );
}
