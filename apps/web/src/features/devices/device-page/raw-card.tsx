import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SectionCard, Table } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { DeviceFacts } from '../components/device-facts';
import { EntityTable } from '../components/entity-table';
import { BlockHeading, Disclosure, JsonBlock } from '../components/panel-parts';
import { RawCommand, ScheduleRawJson } from '../components/raw-sections';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { type DeviceEntity, groupDeviceEntities } from '../lib/entity-sections';

/** Entities this screen has no block for: a gap in ENTITY_SECTION, shown rather than hidden. */
function Unrouted({ entities }: { entities: readonly DeviceEntity[] }) {
  const { t } = useTranslation('devices');
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label={t('rawCard.unrouted')}>
      <BlockHeading title={t('rawCard.unrouted')} />
      <p className="text-sm text-muted-foreground">{t('rawCard.unroutedNote')}</p>
      <Table<DeviceEntity>
        label={t('rawCard.unroutedLabel')}
        variant="compact"
        rows={entities}
        rowKey={e => e.key}
        columns={[
          { key: 'name', header: t('entityTable.entity'), cell: e => e.name },
          {
            key: 'component',
            header: t('entityTable.component'),
            cell: e => e.component,
            muted: true,
          },
          { key: 'key', header: t('rawCard.key'), cell: e => e.key, mono: true },
        ]}
      />
    </section>
  );
}

/**
 * "Entities and raw command": what the device reports, its identity and traffic, the raw
 * payloads, and the raw command box. For debugging, so it opens only on request.
 */
export function RawCard({
  device: d,
  isOpen,
  setOpen,
}: {
  device: DeviceDetail;
  isOpen: OpenState;
  setOpen: SetOpen;
}) {
  const { t } = useTranslation('devices');
  const groups = groupDeviceEntities(d.entities, d.supports_ai);
  const texts = d.entities.filter(e => e.component === 'text');
  const section = (key: string, summary: string, body: ReactNode) => (
    <Disclosure
      summary={summary}
      open={isOpen(`d${d.id}:${key}`, false)}
      onOpenChange={open => {
        setOpen(`d${d.id}:${key}`, open);
      }}
    >
      {body}
    </Disclosure>
  );

  return (
    <SectionCard title={t('rawCard.title')} aside={t('rawCard.aside')}>
      {groups.sensors.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2.5" aria-label={t('stateTitle')}>
          <EntityTable
            label={t('stateLabel', { name: d.name })}
            sensors={groups.sensors}
            all={d.entities}
          />
          {section(
            'rawstate',
            t('rawStateJson'),
            <JsonBlock label={t('parsedState')} value={d.state} />,
          )}
        </section>
      )}
      <DeviceFacts device={d} />
      {groups.unrouted.length > 0 && <Unrouted entities={groups.unrouted} />}
      {texts.length > 0 &&
        section(
          'schedjson',
          t('rawCard.schedulesJson'),
          <ScheduleRawJson device={d} entities={texts} />,
        )}
      {section(
        'diag',
        t('rawCard.diagnostics'),
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-sm font-medium">{t('rawCard.lastState')}</span>
          <JsonBlock
            label={t('rawCard.lastState')}
            value={d.diag.last_state_report ?? { note: t('rawCard.noneYet') }}
          />
          <span className="text-sm font-medium">{t('rawCard.lastProperty')}</span>
          <JsonBlock
            label={t('rawCard.lastProperty')}
            value={d.diag.last_property ?? { note: t('rawCard.noneYet') }}
          />
          <span className="text-sm font-medium">{t('rawCard.connection')}</span>
          <JsonBlock
            label={t('rawCard.connection')}
            value={d.diag.last_connect ?? { note: t('rawCard.noConnect') }}
          />
        </div>,
      )}
      {section('raw', t('rawCard.advanced'), <RawCommand deviceId={d.id} />)}
      <p className="text-sm text-muted-foreground">
        <Trans t={t} i18nKey="rawCard.patchers" components={{ link: <Link to="/patchers" /> }} />
      </p>
    </SectionCard>
  );
}
