import { useState } from 'react';
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

const NAME: TableColumn<AnyEntity> = {
  key: 'name',
  header: 'Entity',
  cell: e => e.name,
  width: '34%',
};
const VALUE: TableColumn<AnyEntity> = {
  key: 'value',
  header: 'Value',
  cell: e => <EntityValue entity={e} />,
};
const COMPONENT: TableColumn<AnyEntity> = {
  key: 'component',
  header: 'Component',
  cell: e => e.component,
  muted: true,
  nowrap: true,
};
const PATH: TableColumn<AnyEntity> = {
  key: 'path',
  header: 'Reads from',
  cell: e => e.value_path || e.key,
  mono: true,
  muted: true,
};

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
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? all : sensors;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Table
        label={label}
        variant="compact"
        columns={showAll ? [NAME, VALUE, COMPONENT, PATH] : [NAME, VALUE, PATH]}
        rows={rows}
        rowKey={e => `${e.component}:${e.key}`}
        emptyText="Nothing reported yet."
      />
      <Switch
        small
        checked={showAll}
        onCheckedChange={setShowAll}
        label={<span className="text-muted-foreground">Show every entity ({all.length})</span>}
      />
    </div>
  );
}
