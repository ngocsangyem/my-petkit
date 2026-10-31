import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { formatEntityValue, MISSING } from '@/shared/format/format';
import { Missing, Switch, Table, type TableColumn } from '@/shared/ui';
import { type AnyEntity, entityLike } from '../lib/entity-sections';

/** A value as Home Assistant shows it: the text, then the unit in muted. */
export function EntityValue({ entity }: { entity: AnyEntity }) {
  const { text, unit } = formatEntityValue(entityLike(entity));
  if (text === MISSING) return <Missing />;
  return (
    <>
      {text}
      {unit && <span className="text-muted-foreground"> {unit}</span>}
    </>
  );
}

/** The table's columns, headed in the active language; the component one only with every entity. */
function entityColumns(showAll: boolean): TableColumn<AnyEntity>[] {
  const name: TableColumn<AnyEntity> = {
    key: 'name',
    header: i18n.t('devices:entityTable.entity'),
    cell: e => e.name,
    width: '34%',
  };
  const value: TableColumn<AnyEntity> = {
    key: 'value',
    header: i18n.t('devices:entityTable.value'),
    cell: e => <EntityValue entity={e} />,
  };
  const component: TableColumn<AnyEntity> = {
    key: 'component',
    header: i18n.t('devices:entityTable.component'),
    cell: e => e.component,
    muted: true,
    nowrap: true,
  };
  const path: TableColumn<AnyEntity> = {
    key: 'path',
    header: i18n.t('devices:entityTable.readsFrom'),
    cell: e => e.value_path || e.key,
    mono: true,
    muted: true,
  };
  return showAll ? [name, value, component, path] : [name, value, path];
}

interface EntityTableProps {
  label: string;
  /** What the device is reporting: its sensors. */
  sensors: readonly AnyEntity[];
  /** Every entity Home Assistant has, for the "Show every entity" switch. */
  all: readonly AnyEntity[];
}

/**
 * The State table and, behind one switch, the whole entity list. Showing every
 * entity is a "let me check something" mode, so it is not remembered: coming
 * back to a wall of 67 rows is not what anyone meant by it.
 */
export function EntityTable({ label, sensors, all }: EntityTableProps) {
  const { t } = useTranslation('devices');
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? all : sensors;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Table
        label={label}
        variant="compact"
        columns={entityColumns(showAll)}
        rows={rows}
        rowKey={e => `${e.component}:${e.key}`}
        emptyText={t('entityTable.empty')}
      />
      <Switch
        small
        checked={showAll}
        onCheckedChange={setShowAll}
        label={
          <span className="text-muted-foreground">
            {t('entityTable.showAll', { count: all.length })}
          </span>
        }
      />
    </div>
  );
}
