import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { i18n } from '@/i18n';
import { relativeTime } from '@/shared/format/format';
import { Card, Pill, type PillTone, StatusWord, type StatusTone } from '@/shared/ui';
import type { DeviceStatus } from '@/shared/ui';
import { DeviceArt } from '../components/device-art';
import type { DeviceRow } from '../hooks/use-overview';
import { useDeviceLinks } from '../lib/device-view';

const PILL_TONE: Record<DeviceStatus, PillTone> = {
  online: 'positive',
  polling: 'neutral',
  offline: 'negative',
  unknown: 'neutral',
};

/** The third line: how it reaches the server and when it last did. */
function transportLine(row: DeviceRow): { tone: StatusTone; text: string; dot: boolean } {
  const ago = row.lastReport === null ? i18n.t('devices:never') : relativeTime(row.lastReport);
  if (row.kind === 'accessory') {
    return { tone: 'muted', text: `${row.type.toUpperCase()} · Bluetooth`, dot: false };
  }
  if (row.status.status === 'online' && row.mqtt) {
    return { tone: 'positive', text: `MQTT · ${ago}`, dot: true };
  }
  if (row.status.status === 'polling')
    return { tone: 'info', text: i18n.t('devices:card.heartbeat', { ago }), dot: true };
  return { tone: 'muted', text: i18n.t('devices:card.lastReport', { ago }), dot: false };
}

/** The second line: what it is doing, or what is wrong. */
function nowLine(row: DeviceRow): { negative: boolean; text: string } {
  if (row.attention?.tone === 'negative') return { negative: true, text: row.attention.text };
  if (row.kind === 'accessory') {
    const ago =
      row.lastReport === null ? i18n.t('devices:card.neverReported') : relativeTime(row.lastReport);
    return {
      negative: false,
      text: row.parentName
        ? i18n.t('devices:card.via', { parent: row.parentName, ago })
        : (row.attention?.text ?? ago),
    };
  }
  return { negative: false, text: row.now ?? `${row.model} · #${row.id}` };
}

/** A device on Home: its drawing at its real level with a status pill, name, now, transport. */
export function DeviceCard({ row }: { row: DeviceRow }) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const nameId = useId();
  const detailId = useId();
  const pillId = useId();
  const status = row.status.status;
  const now = nowLine(row);
  const transport = transportLine(row);
  return (
    <Card as="li" padding="none" className="list-none">
      <Link
        to={links.device(row.key)}
        aria-labelledby={nameId}
        aria-describedby={`${pillId} ${detailId}`}
        className="flex h-full flex-col gap-2.5 rounded-xl px-2 pt-2 pb-3.5 text-foreground no-underline hover:text-foreground"
      >
        <span className="relative flex h-[140px] items-center justify-center rounded-md bg-raised pt-5">
          <DeviceArt type={row.type} entities={row.entities} size={104} />
          <span id={pillId} className="absolute top-2 left-2">
            <Pill tone={PILL_TONE[status]}>{t(`card.pill.${status}`)}</Pill>
          </span>
        </span>
        <span className="flex min-w-0 flex-col px-1.5">
          <span id={nameId} className="font-semibold">
            {row.name}
          </span>
          <span
            id={detailId}
            className={now.negative ? 'text-sm text-negative' : 'text-sm text-muted-foreground'}
          >
            {now.text}
          </span>
          <span className="text-xs">
            <StatusWord tone={transport.tone} dot={transport.dot}>
              <span className="font-normal">{transport.text}</span>
            </StatusWord>
          </span>
        </span>
      </Link>
    </Card>
  );
}
