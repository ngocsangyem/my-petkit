import { Link } from 'react-router';
import { Button, SettingsRow, SettingsSection, Switch } from '@/shared/ui';
import { type DeviceDetail, deviceKeys } from '../api';
import { setLogUpload, setTimezone } from '../api-calls';
import { usePendingEdit } from '../hooks/pending-edits';
import { useDeviceCall } from '../hooks/use-device-call';
import { LOG_REASONS } from '../lib/delivery-text';
import { FeedbackLine } from './panel-parts';

const SOURCE_TEXT: Readonly<Record<string, string>> = {
  override: 'this override',
  locale: 'the zone name the device reported',
  device: 'the offset the device reported',
  server: "this server's clock",
};

const refreshFor = (id: number) => [deviceKeys.detail(id), deviceKeys.list];

/**
 * The device has no clock of its own: it is given an offset over Bluetooth and
 * burns it into its video watermarks. Setting one here pushes it to a paired
 * device. An empty box means "no override", a real value that hands the device
 * back to what it reported. The device reports back to one decimal (5.75 reads 5.8).
 */
export function TimezoneSection({ device }: { device: DeviceDetail }) {
  const call = useDeviceCall();
  const tz = device.timezoneInfo;
  const deviceValue = tz.override === null ? '' : String(tz.override);
  const [pending, setPending] = usePendingEdit(`tz:${device.id}`, deviceValue);
  const shown = pending ?? deviceValue;

  const submit = () => {
    const raw = shown.trim();
    const offset = raw === '' ? null : Number(raw);
    if (offset !== null && (!Number.isFinite(offset) || offset < -12 || offset > 14)) {
      call.say({ text: 'Must be between -12 and 14 hours', tone: 'error' });
      return;
    }
    void call
      .run(() => setTimezone(device.id, offset), refreshFor(device.id))
      .then(ok => {
        if (ok) setPending(undefined);
      });
  };

  const facts = [
    `Effective UTC${tz.effective >= 0 ? '+' : ''}${tz.effective}, from ${SOURCE_TEXT[tz.source] ?? tz.source}`,
    tz.locale && tz.locale,
    tz.reported !== null && `device said ${tz.reported}`,
  ].filter(Boolean);

  return (
    <SettingsSection title="Timezone" description={facts.join(' · ')}>
      <SettingsRow
        label="Offset from UTC"
        kind="field"
        description={`Hours, -12 to 14 in quarter steps. Empty for automatic.${pending !== undefined ? ' Not sent yet.' : ''}`}
        control={props => (
          <span className="devices-set-field">
            <input
              {...props}
              type="number"
              className={`ui-control ui-control--end${pending !== undefined ? ' devices-dirty' : ''}`}
              min={-12}
              max={14}
              step={0.25}
              placeholder="auto"
              value={shown}
              disabled={call.busy}
              onChange={e => {
                setPending(e.target.value);
              }}
            />
            <Button
              size="small"
              onClick={submit}
              disabled={call.busy}
              aria-label="Set timezone offset"
            >
              Set
            </Button>
          </span>
        )}
      />
      <FeedbackLine feedback={call.feedback} />
    </SettingsSection>
  );
}

/**
 * Lets the device upload its own devRun.log here instead of to PetKit. Needs the
 * cacert patcher, since the upload is HTTPS to our self-signed bucket; the device
 * decides when to send one (a reboot is the usual trigger).
 */
export function LogUploadSection({ device }: { device: DeviceDetail }) {
  const call = useDeviceCall();
  const { log_upload_enabled: on, reason } = device.logInfo;
  return (
    <SettingsSection
      title="Debug log collection"
      description={
        <>
          The firmware’s own view of what it was doing, in the <Link to="/log">Log</Link> screen.
          {reason && ` Cannot collect right now: ${LOG_REASONS[reason] ?? reason}.`}
        </>
      }
    >
      <SettingsRow
        label="Collect debug logs"
        control={props => (
          <Switch
            {...props}
            checked={on}
            disabled={call.busy}
            onCheckedChange={next =>
              void call.run(() => setLogUpload(device.id, next), refreshFor(device.id))
            }
          />
        )}
      />
      <FeedbackLine feedback={call.feedback} />
    </SettingsSection>
  );
}
