import { cn } from 'cn';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { i18n } from '@/i18n';
import { Button, SettingsRow, SettingsSection, Switch } from '@/shared/ui';
import { Input } from '@/shared/ui/shadcn/input';
import { type DeviceDetail, deviceKeys } from '../api';
import { setLogUpload, setTimezone } from '../api-calls';
import { usePendingEdit } from '../hooks/pending-edits';
import { useDeviceCall } from '../hooks/use-device-call';
import { logReasonText } from '../lib/delivery-text';
import { dirtyClass, FeedbackLine } from './panel-parts';

/** Where the effective offset came from, in words; the server's code when unknown. */
function sourceText(source: string): string {
  switch (source) {
    case 'override':
    case 'locale':
    case 'device':
    case 'server':
      return i18n.t(`devices:timezone.source.${source}`);
    default:
      return source;
  }
}

const refreshFor = (id: number) => [deviceKeys.detail(id), deviceKeys.list];

/**
 * The device has no clock of its own: it is given an offset over Bluetooth and
 * burns it into its video watermarks. Setting one here pushes it to a paired
 * device. An empty box means "no override", a real value that hands the device
 * back to what it reported. The device reports back to one decimal (5.75 reads 5.8).
 */
export function TimezoneSection({ device }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  const call = useDeviceCall();
  const tz = device.timezoneInfo;
  const deviceValue = tz.override === null ? '' : String(tz.override);
  const [pending, setPending] = usePendingEdit(`tz:${device.id}`, deviceValue);
  const shown = pending ?? deviceValue;

  const submit = () => {
    const raw = shown.trim();
    const offset = raw === '' ? null : Number(raw);
    if (offset !== null && (!Number.isFinite(offset) || offset < -12 || offset > 14)) {
      call.say({ text: t('timezone.outOfRange'), tone: 'error' });
      return;
    }
    void call
      .run(() => setTimezone(device.id, offset), refreshFor(device.id))
      .then(ok => {
        if (ok) setPending(undefined);
      });
  };

  const facts = [
    t('timezone.effective', {
      offset: `${tz.effective >= 0 ? '+' : ''}${tz.effective}`,
      source: sourceText(tz.source),
    }),
    tz.locale && tz.locale,
    tz.reported !== null && t('timezone.reported', { value: tz.reported }),
  ].filter(Boolean);

  return (
    <SettingsSection title={t('timezone.title')} description={facts.join(' · ')}>
      <SettingsRow
        label={t('timezone.offset')}
        kind="field"
        description={pending !== undefined ? t('timezone.hintPending') : t('timezone.hint')}
        control={props => (
          <span className="flex min-w-0 gap-1.5">
            <Input
              {...props}
              type="number"
              className={cn('min-w-0 flex-1 text-right', dirtyClass(pending !== undefined))}
              min={-12}
              max={14}
              step={0.25}
              placeholder={t('timezone.auto')}
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
              aria-label={t('timezone.setLabel')}
            >
              {t('set')}
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
  const { t } = useTranslation('devices');
  const call = useDeviceCall();
  const { log_upload_enabled: on, reason } = device.logInfo;
  return (
    <SettingsSection
      title={t('logs.title')}
      description={
        <>
          <Trans t={t} i18nKey="logs.description" components={{ log: <Link to="/log" /> }} />
          {reason && ` ${t('logs.cannotCollect', { reason: logReasonText(reason) })}`}
        </>
      }
    >
      <SettingsRow
        label={t('logs.collect')}
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
