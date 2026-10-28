import { Icon, InlineField, Select, type SelectOption } from '@/shared/ui';
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
    <div className="tl-toolbar">
      <button
        type="button"
        className="tl-icon-btn"
        aria-label="Previous day"
        onClick={() => {
          onDate(shiftDay(date, -1));
        }}
      >
        <Icon name="chevron" className="tl-icon-btn__prev" />
      </button>
      <InlineField label="Date">
        <input
          type="date"
          className="ui-control tl-date"
          value={date}
          max={today}
          onChange={e => {
            if (isDateString(e.target.value)) onDate(e.target.value);
          }}
        />
      </InlineField>
      <button
        type="button"
        className="tl-icon-btn"
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => {
          onDate(shiftDay(date, 1));
        }}
      >
        <Icon name="chevron" className="tl-icon-btn__next" />
      </button>
      <span className="tl-toolbar__gap" />
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
