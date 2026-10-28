import type { ReactNode } from 'react';
import { SettingsSection, ValueText } from '@/shared/ui';
import type { ServerInfo } from '../setup-model';

interface Fact {
  label: string;
  value: ReactNode;
  note: string;
}

function Word({ tone, children }: { tone: 'positive' | 'negative' | 'muted'; children: string }) {
  return <span className={`setup-word setup-word--${tone}`}>{children}</span>;
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
      value: <span className="setup-mono">{info.version}</span>,
      note: 'The code actually running. If an update did not take effect this still shows the old number, the quickest way to tell a stale build from a real bug.',
    },
    {
      label: 'API URL',
      value: (
        <span className="setup-mono">
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
        <span className="setup-num">
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
      value: <span className="setup-num">{info.device_count}</span>,
      note: 'Devices this server knows.',
    },
  ];

  return (
    <SettingsSection
      title="Connection"
      description="Bound at startup. Change these in the server configuration, then restart."
    >
      <dl className="setup-facts">
        {facts.map(f => (
          <div key={f.label} className="setup-facts__row">
            <dt className="setup-facts__label">
              <span className="setup-facts__name">{f.label}</span>
              <span className="setup-facts__note">{f.note}</span>
            </dt>
            <dd className="setup-facts__value">{f.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}
