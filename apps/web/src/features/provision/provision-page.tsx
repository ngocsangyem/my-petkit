import { useMemo, useState } from 'react';
import { detectedOffsetHours, timezoneOptions } from '@/ble/provisioning-payload';
import { errorMessage } from '@/shared/api/errors';
import { PageHeading } from '@/shared/ui';
import { useServerInfo } from './api';
import { DevicesFound } from './components/devices-found';
import { EnvironmentNotice, environmentTooltip } from './components/environment-notice';
import { ProvisionForm, type ProvisionFormValues } from './components/provision-form';
import { ProvisionProgress } from './components/provision-progress';
import { SessionLog } from './components/session-log';
import { useBluetoothEnvironment } from './hooks/use-bluetooth-environment';
import { useProvisionSession } from './hooks/use-provision-session';
import './provision.css';

/** Provisioning over Web Bluetooth: Wi-Fi, this server's address and the time zone. */
export function ProvisionPage() {
  const block = useBluetoothEnvironment();
  const info = useServerInfo();
  const session = useProvisionSession();
  const timezones = useMemo(() => timezoneOptions(), []);
  // The browser's offset is only the default: the device is not always in
  // the same zone as the browser provisioning it.
  const detectedHours = useMemo(() => detectedOffsetHours(new Date().getTimezoneOffset()), []);
  const zoneName = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || '', []);
  const [form, setForm] = useState<Omit<ProvisionFormValues, 'server'> & { server: string | null }>(
    { ssid: '', pwd: '', server: null, tz: String(detectedHours) },
  );
  // Untouched, the server field shows the address this server tells devices to use.
  const server = form.server ?? info.data?.api_url ?? '';
  const values: ProvisionFormValues = { ...form, server };

  const send = () => {
    void session.send({
      ssid: values.ssid.trim(),
      pwd: values.pwd,
      server: values.server.trim(),
      timezone: Number(values.tz),
      zoneName,
      browserLanguage: navigator.language,
    });
  };

  return (
    <div className="provision-page">
      <div className="provision-intro">
        <PageHeading
          title="Provision a device"
          aside="Sends Wi-Fi, this server’s address and the time zone over Bluetooth. No PetKit app involved."
        />
        <ProvisionProgress
          wifiDone={values.ssid.trim() !== '' && values.pwd !== ''}
          serverDone={values.server.trim() !== '' && values.tz !== ''}
          sent={session.outcome === 'provisioned'}
        />
      </div>
      <EnvironmentNotice block={block} />
      <div className="provision-columns">
        <ProvisionForm
          values={values}
          onChange={patch => {
            setForm(prev => ({ ...prev, ...patch }));
          }}
          timezones={timezones}
          detectedHours={detectedHours}
          zoneName={zoneName}
          serverLoading={info.isPending && form.server === null}
          serverError={info.isError ? errorMessage(info.error) : null}
          onRetryServer={() => {
            void info.refetch();
          }}
          blocked={block !== null}
          blockedReason={environmentTooltip(block)}
          busy={session.busy}
          status={session.status}
          onFind={() => {
            void session.findDevice();
          }}
          onSend={send}
        />
        <div className="provision-side">
          <DevicesFound
            devices={session.found}
            selectedId={session.selectedId}
            onSelect={session.setSelectedId}
            disabled={session.busy}
          />
          <SessionLog lines={session.lines} />
        </div>
      </div>
    </div>
  );
}
