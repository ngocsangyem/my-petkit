import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { formatEntityValue } from '@/shared/format/format';
import { Card, type FigureCell, RatioBar } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import {
  CONSUMABLE_SCALE_DAYS,
  CONSUMABLES,
  CONSUMABLE_WARN_DAYS,
  consumableLabel,
  deviceFamily,
  figuresFor,
} from '../lib/device-family';
import { binaryOn, entityLike, findEntity, numericValue } from '../lib/entity-sections';

/**
 * The figure cells this model publishes, in the family's order. Only figures whose entity the
 * device actually publishes are drawn, so a model with fewer sensors gets fewer cells.
 */
export function figureCells(device: DeviceDetail, visitsToday: number | null): FigureCell[] {
  const family = deviceFamily(device.type);
  const cells: FigureCell[] = [];
  for (const spec of figuresFor(family)) {
    const e = findEntity(device.entities, spec.key);
    if (!e) continue;
    if (spec.binary) {
      const on = binaryOn(e);
      cells.push({
        id: spec.key,
        label: spec.label,
        value: on === null ? null : spec.binary[on ? 1 : 0],
        missingText: i18n.t('devices:notReported'),
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
      cells.push({ id: 'visits', label: i18n.t('devices:figure.visitsToday'), value: visitsToday });
    }
  }
  return cells;
}

const daysText = (days: number) =>
  days <= 0
    ? i18n.t('devices:consumables.usedUp')
    : i18n.t('devices:consumables.days', { count: days });

/** True when the device publishes any consumable this card shows. */
export function hasConsumables(device: DeviceDetail): boolean {
  return (
    CONSUMABLES.some(key => numericValue(findEntity(device.entities, key)) !== null) ||
    numericValue(findEntity(device.entities, 'filter_percent')) !== null
  );
}

/**
 * Consumables: each one's name and days left over a bar against a month; running low turns the
 * figure and the bar to the warning colour. The filter's percentage gets a bar of its own.
 */
export function ConsumablesCard({ device }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  const headingId = useId();
  const filter = numericValue(findEntity(device.entities, 'filter_percent'));
  const consumables = CONSUMABLES.flatMap(key => {
    const days = numericValue(findEntity(device.entities, key));
    return days === null ? [] : [{ key, label: consumableLabel(key), days }];
  });
  if (!consumables.length && filter === null) return null;
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId}>{t('consumables.title')}</h2>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0" aria-label={t('consumables.title')}>
        {consumables.map(c => {
          const low = c.days <= CONSUMABLE_WARN_DAYS;
          return (
            <li key={c.key} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-4">
                <span>{c.label}</span>
                <span className={low ? 'font-semibold text-warning' : undefined}>
                  {daysText(c.days)}
                </span>
              </span>
              <RatioBar
                value={Math.max(0, c.days)}
                max={CONSUMABLE_SCALE_DAYS}
                tone={low ? 'warning' : 'accent'}
                ariaLabel={t('consumables.remaining', { label: c.label })}
              />
            </li>
          );
        })}
        {filter !== null && (
          <li className="flex flex-col gap-1.5">
            <span className="flex justify-between gap-4">
              <span>{t('consumables.filterLeft')}</span>
              <span className={filter <= 10 ? 'font-semibold text-warning' : undefined}>
                {filter} %
              </span>
            </span>
            <RatioBar
              value={filter}
              max={100}
              tone={filter <= 10 ? 'warning' : 'accent'}
              ariaLabel={t('consumables.filterRemaining')}
            />
          </li>
        )}
      </ul>
    </Card>
  );
}
