import type { ReactNode } from 'react';
import { SettingsSection, ValueText } from '@/shared/ui';
import type { ServerInfo } from '../setup-model';

interface Fact {
  label: string;
  value: ReactNode;
  note: string;
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

function bridgeWord(info: ServerInfo) {
  if (!info.ha_enabled) return <Word tone="muted">Disabled</Word>;
  return info.ha_publishing ? (
    <Word tone="positive">Publishing</Word>
  ) : (
    <Word tone="negative">Down</Word>
  );
}

/** Facts bound at startup: what a device dials, the broker, the certificate, the HA bridge. */
export function ConnectionFacts({ info }: { info: ServerInfo }) {
  const facts: Fact[] = [
    {
      label: 'Version',
      value: <span className="font-mono text-xs wrap-anywhere">{info.version}</span>,
      note: 'The code actually running. If an update did not take effect this still shows the old number, the quickest way to tell a stale build from a real bug.',
    },
    {
      label: 'API URL',
      value: (
        <span className="font-mono text-xs wrap-anywhere">
          <ValueText value={info.api_url} />
        </span>
      ),
      note: 'The URL a device calls. Most models take it over Bluetooth from Provision; the oldest, which have no Bluetooth setup, need a DNS redirect.',
    },
    {
      label: 'MQTT host',
      value: 'Automatic',
      note: 'Every device is handed this server’s own broker, derived from the API URL host. A patched device connects over MQTT; an unpatched one keeps to the HTTP heartbeat, and commands fall back to it.',
    },
    {
      label: 'MQTT broker port',
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
      note: 'The plain port, and the TLS port when TLS is on.',
    },
    {
      label: 'TLS certificate',
      value: info.cert_exists ? (
        <Word tone="positive">Present</Word>
      ) : (
        <Word tone="negative">Missing</Word>
      ),
      note: 'The self-signed certificate the broker presents. Missing means the file named by cert_path is not there, and a device that expects TLS will not connect.',
    },
    {
      label: 'MQTT auth',
      value: info.strict_auth ? 'Strict HMAC' : 'Accept-all',
      note: 'Accept-all is fine on a trusted LAN; strict enforces the Aliyun HMAC-SHA256 sign.',
    },
    {
      label: 'Bridge to Home Assistant',
      value: bridgeWord(info),
      note: 'The connection to Home Assistant’s broker, not the one devices talk to: a device can be healthy while this is down. Disabled means publishing was switched off, a valid way to run.',
    },
    {
      label: 'Devices',
      value: <span className="tabular-nums">{info.device_count}</span>,
      note: 'Devices this server knows.',
    },
  ];

  return (
    <SettingsSection
      title="Connection"
      description="Bound at startup. Change these in the server configuration, then restart."
    >
      <dl className="m-0 flex flex-col">
        {facts.map(f => (
          <div
            key={f.label}
            className="grid grid-cols-1 items-start gap-1 py-3 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-border min-[901px]:grid-cols-[minmax(0,1fr)_minmax(120px,220px)] min-[901px]:gap-4"
          >
            <dt className="flex flex-col gap-0.5">
              <span className="font-medium">{f.label}</span>
              <span className="text-sm text-muted-foreground">{f.note}</span>
            </dt>
            <dd className="m-0 wrap-anywhere min-[901px]:text-right">{f.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}
