import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import {
  Button,
  buttonClassName,
  ConfirmDialog,
  ErrorBlock,
  Icon,
  Panel,
  Skeleton,
} from '@/shared/ui';
import { type Sound, deviceKeys, useSounds } from '../api';
import { deleteSound, playSound, selectSound, uploadSound } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

// The server's limits (features/sounds/routes.py): checked here first so a file
// that cannot be stored is refused before it is sent.
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const MAX_SOUNDS = 10;

/** Custom sounds on a camera feeder: upload, list, play, select, delete. */
export function SoundsBody({ deviceId }: { deviceId: number }) {
  const { t } = useTranslation('devices');
  const sounds = useSounds(deviceId, true);
  const call = useDeviceCall();
  const [deleting, setDeleting] = useState<Sound | null>(null);
  const refresh = [deviceKeys.sounds(deviceId)];
  const list = sounds.data ?? [];

  const upload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SOUND_BYTES) {
      call.say({ text: t('sounds.tooLarge', { name: file.name }), tone: 'error' });
      return;
    }
    if (list.length >= MAX_SOUNDS) {
      call.say({
        text: t('sounds.tooMany', { max: MAX_SOUNDS }),
        tone: 'error',
      });
      return;
    }
    void call.run(() => uploadSound(deviceId, file), refresh);
  };

  if (sounds.isPending) return <Skeleton height={88} />;
  if (sounds.error) {
    return (
      <ErrorBlock
        message={t('sounds.loadFailed', { error: errorMessage(sounds.error) })}
        onRetry={() => void sounds.refetch()}
        retrying={sounds.isFetching}
      />
    );
  }
  const full = call.busy || list.length >= MAX_SOUNDS;
  return (
    <>
      <Panel padding="none" className="px-4 py-1">
        <ul className="m-0 flex list-none flex-col p-0" aria-label={t('sounds.custom')}>
          {list.length === 0 && (
            <li className="flex min-h-13 items-center text-muted-foreground">
              {t('sounds.empty')}
            </li>
          )}
          {list.map(s => (
            <li
              key={s.id}
              className="flex min-h-13 flex-wrap items-center gap-2 py-1.5 [&+&]:border-t [&+&]:border-rule"
            >
              <span className="flex min-w-40 flex-1 flex-col">
                <span className="truncate">{s.name || t('sounds.fallbackName', { id: s.id })}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{s.filename}</span> · {formatBytes(s.size)}
                </span>
              </span>
              <Button
                size="small"
                disabled={call.busy}
                onClick={() => void call.run(() => playSound(deviceId, s.id), refresh)}
              >
                <Icon name="play" size={14} />
                {t('sounds.play')}
              </Button>
              <Button
                size="small"
                disabled={call.busy}
                onClick={() => void call.run(() => selectSound(deviceId, s.id), refresh)}
              >
                {t('sounds.select')}
              </Button>
              <Button
                size="small"
                variant="ghost"
                className="text-negative"
                disabled={call.busy}
                onClick={() => {
                  setDeleting(s);
                }}
              >
                {t('sounds.delete')}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      <label
        className={buttonClassName(
          'secondary',
          'regular',
          full ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        )}
      >
        <Icon name="upload" size={16} />
        {t('sounds.upload')}
        <input
          type="file"
          className="sr-only"
          accept="audio/*"
          disabled={full}
          onChange={e => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <FeedbackLine feedback={call.feedback} />
      <p className="text-xs text-muted-foreground">
        {t('sounds.note', { max: MAX_SOUNDS, stored: list.length })}
      </p>
      <ConfirmDialog
        open={deleting !== null}
        title={t('sounds.deleteTitle')}
        confirmLabel={t('sounds.delete')}
        busy={call.busy}
        onCancel={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          const s = deleting;
          if (!s) return;
          void call
            .run(() => deleteSound(deviceId, s.id), refresh)
            .then(() => {
              setDeleting(null);
            });
        }}
      >
        <p>{t('sounds.deleteBody', { name: deleting?.name || t('sounds.thisSound') })}</p>
      </ConfirmDialog>
    </>
  );
}
