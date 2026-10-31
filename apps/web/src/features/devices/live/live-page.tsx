import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card, Icon, PageHeader } from '@/shared/ui';
import { Button } from '@/shared/ui/shadcn/button';
import { type DeviceDetail, deviceKeys } from '../api';
import { sendAction } from '../api-calls';
import { type Command, commandIcon, useCommands } from '../components/command-list';
import { StreamUrls } from '../components/stream-urls';
import { isPanCommand, panButtons } from '../device-page/camera-pan-row';
import { deviceFamily, familyNoun } from '../lib/device-family';
import { useDeviceLinks } from '../lib/device-view';
import { groupDeviceEntities } from '../lib/entity-sections';
import { ON_DARK } from './live-frame';
import { LiveView } from './live-view';

/** Commands worth a button beside the picture: the light and a clean, never a destructive one. */
const onBar = (c: Command) =>
  !c.destructive && /light|clean/i.test(c.key) && !/cancel/i.test(c.key);

/**
 * A camera's live view as its own page: the picture with its controls on the dark ground, the
 * stream facts, talk (on the iPhone only) and the camera's pan. WebRTC, MSE and HLS as the server
 * offers them.
 */
export function LivePage({ device: d }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const noun = familyNoun(deviceFamily(d.type)).toLowerCase();
  const runner = useCommands({
    target: noun,
    route: d.mqtt_connected ? t('page.routeMqtt') : t('page.routeHeartbeat'),
    refresh: [deviceKeys.detail(d.id), deviceKeys.list],
  });
  const commands: Command[] = d.actions.map(a => ({
    key: a.key,
    name: a.name,
    destructive: a.destructive,
    run: () => sendAction(d.id, a.key),
  }));
  const pan = commands.filter(isPanCommand);
  const bar = commands.filter(c => !isPanCommand(c) && onBar(c));
  const media = groupDeviceEntities(d.entities, d.supports_ai).media;
  const lastClip = typeof d.state?.lastClipPath === 'string' ? d.state.lastClipPath : null;
  const hasIp = typeof d.state?.ip === 'string' && d.state.ip !== '';
  const back = { to: links.device(`d${d.id}`), label: d.name };

  const barButtons = (
    <>
      {bar.map(c => (
        <Button
          key={c.key}
          className={ON_DARK}
          disabled={runner.busy}
          onClick={() => {
            runner.ask(c);
          }}
        >
          <Icon name={commandIcon(c.key)} size={16} />
          {c.name}
        </Button>
      ))}
      {pan.length > 0 && (
        <span
          role="group"
          aria-label={t('pan.camera')}
          className="flex flex-wrap gap-2.5 min-[901px]:ml-auto"
        >
          {panButtons(pan).map(({ command, word }) => (
            <Button
              key={command.key}
              className={ON_DARK}
              aria-label={command.name}
              disabled={runner.busy}
              onClick={() => {
                runner.ask(command);
              }}
            >
              {word}
            </Button>
          ))}
        </span>
      )}
      {runner.feedback && (
        <span aria-live="polite" className="basis-full text-sm">
          {runner.feedback.text}
        </span>
      )}
    </>
  );

  const streamExtra = (
    <div className="flex min-w-0 flex-col gap-2.5 border-t border-rule pt-3">
      <StreamUrls streams={d.streams} hasIp={hasIp} />
      {lastClip && (
        <p className="text-sm text-muted-foreground">
          <Trans
            t={t}
            i18nKey="live.page.lastClip"
            values={{ path: lastClip }}
            components={{ code: <code className="font-mono text-sm wrap-anywhere" /> }}
          />
        </p>
      )}
      {media.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('live.page.entities', { keys: media.map(e => e.key).join(', ') })}{' '}
          <Link to="/timeline">{t('live.page.clipsOnTimeline')}</Link>
        </p>
      )}
    </div>
  );

  const side = (
    <>
      <Card as="section" aria-label={t('live.page.talk')} className="flex flex-col gap-2">
        <h2>{t('live.page.talk')}</h2>
        <p className="text-sm text-muted-foreground">{t('live.page.talkNote')}</p>
      </Card>
      {pan.length > 0 && (
        <Card as="section" aria-label={t('pan.camera')} className="flex flex-col gap-2">
          <h2>{t('pan.camera')}</h2>
          <p className="text-sm text-muted-foreground">{t('live.page.panNote')}</p>
        </Card>
      )}
    </>
  );

  return (
    <>
      {d.is_camera ? (
        <LiveView
          deviceId={d.id}
          deviceName={d.name}
          renderHeader={modes => <PageHeader title={t('liveView')} back={back} actions={modes} />}
          barExtra={barButtons}
          streamExtra={streamExtra}
          side={side}
        />
      ) : (
        <>
          <PageHeader title={t('liveView')} back={back} finding={t('live.page.noCamera')} />
          <Card as="section" aria-label={t('live.stream')} className="flex flex-col gap-2.5">
            <h2>{t('live.stream')}</h2>
            {streamExtra}
          </Card>
        </>
      )}
      {runner.dialog}
    </>
  );
}
