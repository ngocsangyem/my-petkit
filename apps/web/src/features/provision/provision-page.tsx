import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { detectedOffsetHours, timezoneOptions } from '@/ble/provisioning-payload';
import { errorMessage } from '@/shared/api/errors';
import { Button, Card, Icon, PageHeader } from '@/shared/ui';
import { useServerInfo } from './api';
import { DevicesFound } from './components/devices-found';
import { EnvironmentNotice, environmentTooltip } from './components/environment-notice';
import { ProvisionForm, type ProvisionFormValues } from './components/provision-form';
import { ProvisionProgressPill, ProvisionSteps } from './components/provision-progress';
import { SessionLog } from './components/session-log';
import { useBluetoothEnvironment } from './hooks/use-bluetooth-environment';
import { useProvisionSession } from './hooks/use-provision-session';

/** Provisioning over Web Bluetooth: Wi-Fi, this server's address and the time zone. */
export function ProvisionPage() {
  const { t } = useTranslation('provision');
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

  const progress = {
    wifiDone: values.ssid.trim() !== '' && values.pwd !== '',
    serverDone: values.server.trim() !== '' && values.tz !== '',
    sent: session.outcome === 'provisioned',
  };
  const chosen = session.found.find(d => d.id === session.selectedId);

  return (
    <>
      <PageHeader
        title={t('title')}
        finding={t('finding')}
        actions={<ProvisionProgressPill {...progress} />}
      />
      {block && (
        <Card padding="none">
          <EnvironmentNotice block={block} />
        </Card>
      )}
      <div className="grid grid-cols-1 items-start gap-5 min-[901px]:grid-cols-2">
        <Card as="section" aria-labelledby="provision-device" className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">{t('newDevice')}</span>
            <h2
              id="provision-device"
              className={chosen ? 'font-mono text-base wrap-anywhere' : undefined}
            >
              {chosen ? chosen.name : t('noneChosen')}
            </h2>
          </div>
          <ProvisionSteps {...progress} />
          <DevicesFound
            devices={session.found}
            selectedId={session.selectedId}
            onSelect={session.setSelectedId}
            disabled={session.busy}
          />
          <SessionLog lines={session.lines} />
          <div>
            <Button
              disabled={block !== null || session.busy}
              title={environmentTooltip(block)}
              onClick={() => {
                void session.findDevice();
              }}
            >
              {t('findDevice')}
            </Button>
          </div>
        </Card>
        <Card as="section" aria-label={t('networkAndServer')}>
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
            onSend={send}
          />
        </Card>
      </div>
      <Card className="flex items-start gap-2.5 py-3.5 text-lede">
        <Icon name="provision" size={18} className="mt-0.5 flex-none text-muted-foreground" />
        <p>{t('browserNote')}</p>
      </Card>
    </>
  );
}
