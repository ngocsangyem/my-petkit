import { formatEntityValue } from '@/shared/format/format';
import { FigureContainer, type FigureCell, RatioBar } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { CONSUMABLES, CONSUMABLE_WARN_DAYS, FIGURES, deviceFamily } from '../lib/device-family';
import { binaryOn, entityLike, findEntity, numericValue } from '../lib/entity-sections';

interface ModelBlockProps {
  device: DeviceDetail;
  /** Litter-box visits today in the device's own day; null when not known. */
  visitsToday: number | null;
}

/** The figure cells this model publishes, in the family's order. */
function figureCells(device: DeviceDetail, visitsToday: number | null): FigureCell[] {
  const family = deviceFamily(device.type);
  const cells: FigureCell[] = [];
  for (const spec of FIGURES[family]) {
    const e = findEntity(device.entities, spec.key);
    if (!e) continue;
    if (spec.binary) {
      const on = binaryOn(e);
      cells.push({
        id: spec.key,
        label: spec.label,
        value: on === null ? null : spec.binary[on ? 1 : 0],
        missingText: 'Not reported',
      });
      continue;
    }
    const { text, unit } = formatEntityValue(entityLike(e));
    cells.push({
      id: spec.key,
      label: spec.label,
      value: e.value === null || e.value === undefined ? null : text,
      unit: unit ?? undefined,
    });
    // Visits sit third on a litter box, after the two levels.
    if (family === 'litter' && spec.key === 'litter_percent') {
      cells.push({ id: 'visits', label: 'Visits today', value: visitsToday });
    }
  }
  return cells;
}

/**
 * The top of a device panel, laid out like the design's litter-box block and
 * reused for every model with its own entities: a figure container, then the
 * consumables. Only what the model publishes is drawn.
 */
export function ModelBlock({ device, visitsToday }: ModelBlockProps) {
  const cells = figureCells(device, visitsToday);
  const filter = numericValue(findEntity(device.entities, 'filter_percent'));
  const consumables = CONSUMABLES.flatMap(c => {
    const days = numericValue(findEntity(device.entities, c.key));
    return days === null ? [] : [{ ...c, days }];
  });
  if (!cells.length && !consumables.length) return null;
  return (
    <div className="devices-stack">
      {cells.length > 0 && <FigureContainer label={`${device.name} figures`} cells={cells} />}
      {(consumables.length > 0 || filter !== null) && (
        <ul className="devices-consumables" aria-label="Consumables">
          {consumables.map(c => {
            const low = c.days <= CONSUMABLE_WARN_DAYS;
            return (
              <li key={c.key} className="devices-consumables__row">
                <span>{c.label}</span>
                <span className={low ? 'devices-warning' : undefined}>
                  {c.days <= 0 ? 'Used up' : `${c.days} ${c.days === 1 ? 'day' : 'days'}`}
                </span>
              </li>
            );
          })}
          {filter !== null && (
            <li className="devices-consumables__bar">
              <RatioBar
                name="Filter left"
                value={filter}
                max={100}
                tone={filter <= 10 ? 'warning' : 'accent'}
                label={`${filter} %`}
                ariaLabel="Filter remaining"
              />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
