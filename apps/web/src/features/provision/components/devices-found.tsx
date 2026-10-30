import { EmptyBlock } from '@/shared/ui';
import type { FoundDevice } from '../hooks/use-provision-session';
import { FIELDSET } from './provision-form';

interface DevicesFoundProps {
  devices: readonly FoundDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
}

/**
 * Devices picked from the browser's chooser this visit. Web Bluetooth hands
 * the page one device per chooser and no signal strength, so the list grows
 * with each Find device and shows what the device advertised.
 */
export function DevicesFound({ devices, selectedId, onSelect, disabled }: DevicesFoundProps) {
  return (
    <fieldset className={FIELDSET}>
      <legend className="mb-1.5 p-0 text-sm text-muted-foreground">Devices found</legend>
      {devices.length === 0 ? (
        <EmptyBlock>
          No device chosen yet. Use Find device, then pick it from the browser’s list.
        </EmptyBlock>
      ) : (
        <div className="flex flex-col">
          {devices.map(d => (
            <label
              key={d.id}
              className="flex min-h-(--pk-row-height) cursor-pointer items-center gap-3 border-t border-rule py-1.5"
            >
              <input
                type="radio"
                className="m-0 size-4 accent-data"
                name="provision-found"
                value={d.id}
                checked={d.id === selectedId}
                disabled={disabled}
                onChange={() => {
                  onSelect(d.id);
                }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{d.name}</span>
                <span className="font-mono text-xs wrap-anywhere text-muted-foreground">
                  {d.id}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
