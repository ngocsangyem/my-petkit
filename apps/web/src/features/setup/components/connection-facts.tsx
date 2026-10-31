import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SettingsSection, ValueText } from '@/shared/ui';
import type { ServerInfo } from '../setup-model';

/** Each fact's label and note live under `setup:connection.{id}`. */
type FactId =
  'version' | 'apiUrl' | 'mqttHost' | 'mqttPort' | 'cert' | 'auth' | 'bridge' | 'devices';

interface Fact {
  id: FactId;
  value: ReactNode;
}

/** The state word carries the colour; nothing else in the row does. */
const WORD_TONE = {
  positive: 'text-positive',
  negative: 'text-negative',
  muted: 'text-muted-foreground',
} as const;

function Word({ tone, children }: { tone: 'positive' | 'negative' | 'muted'; children: string }) {
  return <span className={WORD_TONE[tone]}>{children}</span>;
}

function bridgeWord(info: ServerInfo, t: TFunction<'setup'>) {
  if (!info.ha_enabled) return <Word tone="muted">{t('connection.disabled')}</Word>;
  return info.ha_publishing ? (
    <Word tone="positive">{t('connection.publishing')}</Word>
  ) : (
    <Word tone="negative">{t('connection.down')}</Word>
  );
}

/** Facts bound at startup: what a device dials, the broker, the certificate, the HA bridge. */
export function ConnectionFacts({ info }: { info: ServerInfo }) {
  const { t } = useTranslation('setup');
  const facts: Fact[] = [
    {
      id: 'version',
      value: <span className="font-mono text-xs wrap-anywhere">{info.version}</span>,
    },
    {
      id: 'apiUrl',
      value: (
        <span className="font-mono text-xs wrap-anywhere">
          <ValueText value={info.api_url} />
        </span>
      ),
    },
    {
      id: 'mqttHost',
      value: t('connection.automatic'),
    },
    {
      id: 'mqttPort',
      value: (
        <span className="tabular-nums">
          <ValueText value={info.mqtt_port} />
          {info.mqtt_tls ? (
            <>
              {' · TLS '}
              <ValueText value={info.mqtt_tls_port} />
            </>
          ) : null}
        </span>
      ),
    },
    {
      id: 'cert',
      value: info.cert_exists ? (
        <Word tone="positive">{t('connection.present')}</Word>
      ) : (
        <Word tone="negative">{t('connection.missing')}</Word>
      ),
    },
    {
      id: 'auth',
      value: info.strict_auth ? t('connection.strictHmac') : t('connection.acceptAll'),
    },
    {
      id: 'bridge',
      value: bridgeWord(info, t),
    },
    {
      id: 'devices',
      value: <span className="tabular-nums">{info.device_count}</span>,
    },
  ];

  return (
    <SettingsSection title={t('connection.title')}>
      <p className="pb-1 text-xs text-muted-foreground">{t('connection.intro')}</p>
      <dl className="m-0 flex flex-col">
        {facts.map(f => (
          <div
            key={f.id}
            className="flex min-h-13 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 [&+&]:border-t [&+&]:border-rule"
          >
            <dt className="flex max-w-[380px] min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span>{t(`connection.${f.id}.label`)}</span>
              <span className="text-xs text-muted-foreground">{t(`connection.${f.id}.note`)}</span>
            </dt>
            <dd className="m-0 text-right wrap-anywhere text-muted-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}
