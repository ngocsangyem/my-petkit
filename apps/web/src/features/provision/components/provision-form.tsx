import type { SyntheticEvent } from 'react';
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
  onFind: () => void;
  onSend: () => void;
}

/** "UTC+07:00", with the browser's zone named on the detected entry. */
function timezoneLabel(o: TimezoneOption, detectedHours: number, zoneName: string): string {
  if (Math.abs(o.hours - detectedHours) >= 1e-9) return o.label;
  return zoneName ? `${o.label} · ${zoneName}, detected` : `${o.label}, detected`;
}

/** The three steps: Wi-Fi, server and time zone, then send. */
export function ProvisionForm(props: ProvisionFormProps) {
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
    <form className="provision-form" onSubmit={submit} noValidate>
      <fieldset className="provision-fieldset" disabled={blocked}>
        <legend className="provision-legend">Wi-Fi network</legend>
        <StackedField
          label="Wi-Fi name"
          hint="The network the device will join, not necessarily the one this browser is on."
        >
          <TextInput
            value={values.ssid}
            autoComplete="off"
            spellCheck={false}
            onChange={e => {
              onChange({ ssid: e.target.value });
            }}
          />
        </StackedField>
        <StackedField
          label="Password"
          hint="Required: an open network cannot be provisioned this way. It goes from this page to the device over Bluetooth, never to this server or to PetKit."
        >
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

      <fieldset className="provision-fieldset" disabled={blocked}>
        <legend className="provision-legend">Server and time</legend>
        <StackedField
          label="Server devices will use"
          hint="Burned in at provisioning: use an IP, or a name the device itself can resolve."
        >
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
            message={`Could not read this server’s address (${props.serverError}). Type it in, or retry.`}
            onRetry={props.onRetryServer}
          />
        )}
        <ServerUrlWarnings value={values.server} />
        <StackedField
          label="Time zone"
          hint="The device has no clock settings of its own: it keeps this fixed offset, with no daylight saving. Changing it later means provisioning again."
        >
          <Select
            className="provision-select"
            value={values.tz}
            options={tzOptions}
            onChange={e => {
              onChange({ tz: e.target.value });
            }}
          />
        </StackedField>
      </fieldset>

      <div className="provision-send">
        <h2 className="provision-legend">Send</h2>
        <span className="provision-muted-body">
          Hold the device’s button until it beeps, then choose it from the browser’s list.
        </span>
        <div className="provision-send__actions">
          <Button disabled={off} title={props.blockedReason} onClick={props.onFind}>
            Find device
          </Button>
          <Button type="submit" variant="primary" disabled={off} title={props.blockedReason}>
            Send to device
          </Button>
        </div>
        <p role="status" className="provision-status">
          {props.status}
        </p>
        <span className="provision-footnote">
          Web Bluetooth needs Chrome or Edge on desktop or Android, and a secure context: a page
          with a trusted certificate. On an iPhone, use the my-petkit app.
        </span>
      </div>
    </form>
  );
}
