import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import {
  Button,
  buttonClassName,
  ConfirmDialog,
  ErrorBlock,
  Icon,
  OverlayTitleRow,
  Panel,
  Skeleton,
} from '@/shared/ui';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/shadcn/dialog';
import { type Sound, deviceKeys, useSounds } from '../api';
import { deleteSound, playSound, selectSound, uploadSound } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

// The server's limits (features/sounds/routes.py): checked here first so a file
// that cannot be stored is refused before it is sent.
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const MAX_SOUNDS = 10;

/** Custom sounds on a camera feeder: upload, list, play, select, delete. */
function SoundsBody({ deviceId }: { deviceId: number }) {
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
  const full = call.busy || list.length >= MAX_SOUNDS;
  return (
    <>
      <Panel padding="none" className="px-4 py-1">
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Custom sounds">
          {list.length === 0 && (
            <li className="flex min-h-13 items-center text-muted-foreground">
              No custom sounds uploaded.
            </li>
          )}
          {list.map(s => (
            <li
              key={s.id}
              className="flex min-h-13 flex-wrap items-center gap-2 py-1.5 [&+&]:border-t [&+&]:border-rule"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{s.name || `Sound ${s.id}`}</span>
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
                variant="ghost"
                className="text-negative"
                disabled={call.busy}
                onClick={() => {
                  setDeleting(s);
                }}
              >
                Delete
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
        Upload a sound
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
        Up to {MAX_SOUNDS} uploads ({list.length} stored), 2 MB each. Play sends the sound to the
        device once, so you hear it there; Select makes it the one the device uses.
      </p>
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
    </>
  );
}

/**
 * The "Sounds" row of a device's settings, and the dialog it opens. The list is read only while
 * the dialog is open.
 */
export function SoundsRow({ deviceId, deviceNoun }: { deviceId: number; deviceNoun: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex min-h-13 w-full items-center gap-3 border-0 border-t border-rule bg-transparent p-0 text-left text-foreground"
        onClick={() => {
          setOpen(true);
        }}
      >
        <span className="flex-1">Sounds</span>
        <span className="text-muted-foreground">Custom sounds</span>
        <Icon name="forward" size={16} className="text-muted-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[520px] gap-4 overflow-y-auto sm:max-w-[520px]"
        >
          <OverlayTitleRow
            onClose={() => {
              setOpen(false);
            }}
          >
            <DialogTitle>Sounds</DialogTitle>
          </OverlayTitleRow>
          <DialogDescription className="-mt-2">
            Custom sounds the {deviceNoun} can play, stored on this server.
          </DialogDescription>
          {open && <SoundsBody deviceId={deviceId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
