import { EmptyBlock } from '@/shared/ui';
import type { FoundDevice } from '../hooks/use-provision-session';

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
    <fieldset className="provision-fieldset">
      <legend className="provision-legend">Devices found</legend>
      {devices.length === 0 ? (
        <EmptyBlock>
          No device chosen yet. Use Find device, then pick it from the browser’s list.
        </EmptyBlock>
      ) : (
        <div className="provision-found">
          {devices.map(d => (
            <label key={d.id} className="provision-found__row">
              <input
                type="radio"
                name="provision-found"
                value={d.id}
                checked={d.id === selectedId}
                disabled={disabled}
                onChange={() => {
                  onSelect(d.id);
                }}
              />
              <span className="provision-found__text">
                <span className="provision-strong">{d.name}</span>
                <span className="provision-found__id provision-mono">{d.id}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
