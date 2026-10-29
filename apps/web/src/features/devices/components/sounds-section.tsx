import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import { Button, ConfirmDialog, ErrorBlock, Skeleton, Table } from '@/shared/ui';
import { type Sound, deviceKeys, useSounds } from '../api';
import { deleteSound, playSound, selectSound, uploadSound } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

// The server's limits (features/sounds/routes.py): checked here first so a file
// that cannot be stored is refused before it is sent.
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const MAX_SOUNDS = 10;

/** Custom sounds on a camera feeder: upload, list, play, select, delete. */
export function SoundsSection({ deviceId }: { deviceId: number }) {
  const sounds = useSounds(deviceId, true);
  const call = useDeviceCall();
  const [deleting, setDeleting] = useState<Sound | null>(null);
  const refresh = [deviceKeys.sounds(deviceId)];
  const list = sounds.data ?? [];

  const upload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SOUND_BYTES) {
      call.say({ text: `${file.name} is larger than 2 MB`, tone: 'error' });
      return;
    }
    if (list.length >= MAX_SOUNDS) {
      call.say({
        text: `A device holds at most ${MAX_SOUNDS} sounds; delete one first`,
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
        message={`Could not load the sounds: ${errorMessage(sounds.error)}`}
        onRetry={() => void sounds.refetch()}
        retrying={sounds.isFetching}
      />
    );
  }
  return (
    <div className="devices-stack">
      <Table<Sound>
        label="Custom sounds"
        variant="compact"
        rows={list}
        rowKey={s => String(s.id)}
        emptyText="No custom sounds uploaded."
        columns={[
          { key: 'name', header: 'Sound', cell: s => s.name || `Sound ${s.id}` },
          {
            key: 'size',
            header: 'Size',
            cell: s => formatBytes(s.size),
            numeric: true,
            muted: true,
          },
          {
            key: 'actions',
            header: 'Actions',
            hiddenHeader: true,
            alignEnd: true,
            cell: s => (
              <span className="devices-command-row devices-command-row--end">
                <Button
                  size="small"
                  disabled={call.busy}
                  onClick={() => void call.run(() => playSound(deviceId, s.id), refresh)}
                >
                  Play
                </Button>
                <Button
                  size="small"
                  disabled={call.busy}
                  onClick={() => void call.run(() => selectSound(deviceId, s.id), refresh)}
                >
                  Select
                </Button>
                <Button
                  size="small"
                  variant="destructive"
                  disabled={call.busy}
                  onClick={() => {
                    setDeleting(s);
                  }}
                >
                  Delete
                </Button>
              </span>
            ),
          },
        ]}
      />
      <label className="devices-upload">
        <span className="devices-muted">
          Upload a sound (audio, up to 2 MB, at most {MAX_SOUNDS}; {list.length} stored)
        </span>
        <input
          type="file"
          accept="audio/*"
          disabled={call.busy || list.length >= MAX_SOUNDS}
          onChange={e => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <FeedbackLine feedback={call.feedback} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this sound?"
        confirmLabel="Delete"
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
        <p>
          “{deleting?.name || 'This sound'}” is removed from this server and from the device’s list.
        </p>
      </ConfirmDialog>
    </div>
  );
}
