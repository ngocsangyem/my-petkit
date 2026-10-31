import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import type { TimezoneOption } from '@/ble/provisioning-payload';
import { Button, ErrorBlock, Select, Skeleton, StackedField, TextInput } from '@/shared/ui';
import { ServerUrlWarnings } from './server-url-warnings';

export interface ProvisionFormValues {
  ssid: string;
  pwd: string;
  server: string;
  /** Hours east of UTC, as the select's value. */
  tz: string;
}

interface ProvisionFormProps {
  values: ProvisionFormValues;
  onChange: (patch: Partial<ProvisionFormValues>) => void;
  timezones: readonly TimezoneOption[];
  detectedHours: number;
  zoneName: string;
  serverLoading: boolean;
  serverError: string | null;
  onRetryServer: () => void;
  /** The page cannot provision at all: every control is switched off. */
  blocked: boolean;
  blockedReason: string | undefined;
  busy: boolean;
  status: string;
  onSend: () => void;
}

/** A fieldset laid out as a column, with the browser's frame and padding removed. */
export const FIELDSET = 'm-0 flex min-w-0 flex-col gap-3 border-0 p-0';
/** Step heading: 17/600, as an h2. */
export const LEGEND = 'mb-3 p-0 text-lg font-semibold';

/** "UTC+07:00", with the browser's zone named on the detected entry. */
function timezoneLabel(o: TimezoneOption, detectedHours: number, zoneName: string): string {
  if (Math.abs(o.hours - detectedHours) >= 1e-9) return o.label;
  return zoneName
    ? i18n.t('provision:form.detectedZone', { label: o.label, zone: zoneName })
    : i18n.t('provision:form.detected', { label: o.label });
}

/** The Network and Server card: Wi-Fi, server and time zone, then Send to device. */
export function ProvisionForm(props: ProvisionFormProps) {
  const { t } = useTranslation('provision');
  const { values, onChange, blocked, busy } = props;
  const off = blocked || busy;
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!off) props.onSend();
  };
  const tzOptions = props.timezones.map(o => ({
    value: String(o.hours),
    label: timezoneLabel(o, props.detectedHours, props.zoneName),
  }));
  return (
    <form className="flex min-w-0 flex-col gap-5" onSubmit={submit} noValidate>
      <fieldset className={FIELDSET} disabled={blocked}>
        <legend className={LEGEND}>{t('form.network')}</legend>
        <StackedField quiet label={t('form.wifiName')} hint={t('form.wifiNameHint')}>
          <TextInput
            value={values.ssid}
            autoComplete="off"
            spellCheck={false}
            onChange={e => {
              onChange({ ssid: e.target.value });
            }}
          />
        </StackedField>
        <StackedField quiet label={t('form.password')} hint={t('form.passwordHint')}>
          <TextInput
            type="password"
            value={values.pwd}
            autoComplete="off"
            onChange={e => {
              onChange({ pwd: e.target.value });
            }}
          />
        </StackedField>
      </fieldset>

      <fieldset className={FIELDSET} disabled={blocked}>
        <legend className={LEGEND}>{t('form.server')}</legend>
        <StackedField quiet label={t('form.serverUrl')} hint={t('form.serverUrlHint')}>
          {props.serverLoading ? (
            <Skeleton height={32} />
          ) : (
            <TextInput
              mono
              value={values.server}
              autoComplete="off"
              spellCheck={false}
              onChange={e => {
                onChange({ server: e.target.value });
              }}
            />
          )}
        </StackedField>
        {props.serverError && (
          <ErrorBlock
            message={t('form.serverFailed', { error: props.serverError })}
            onRetry={props.onRetryServer}
          />
        )}
        <ServerUrlWarnings value={values.server} />
        <StackedField quiet label={t('form.timeZone')} hint={t('form.timeZoneHint')}>
          <Select
            className="w-full"
            value={values.tz}
            options={tzOptions}
            onChange={e => {
              onChange({ tz: e.target.value });
            }}
          />
        </StackedField>
      </fieldset>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('form.note')}</p>
        <Button
          type="submit"
          variant="primary"
          size="large"
          disabled={off}
          title={props.blockedReason}
        >
          {t('form.send')}
        </Button>
        <p role="status" className="min-h-[1.45em] text-sm">
          {props.status}
        </p>
      </div>
    </form>
  );
}
