import { errorMessage } from '@/shared/api/errors';
import { SectionCard, Switch } from '@/shared/ui';
import { useSetRecognition } from '../api';
import { cacheVerdict, isRecognising, plural, type DeviceDetail } from '../pet-model';

interface RecognitionSectionProps {
  devices: readonly DeviceDetail[];
  /** Every face id we serve, to tell our photos from ones cached from PetKit's cloud. */
  ourFaceIds: readonly number[];
  notify: (text: string, error?: boolean) => void;
}

/**
 * What a device holds, from its `discernPic` readback: the one proof a set of
 * photos was accepted. Ids that are not ours mean it is still matching against
 * photos cached from PetKit's cloud, which is what proxy mode hands it.
 */
function CacheLine({
  device,
  ourFaceIds,
}: {
  device: DeviceDetail;
  ourFaceIds: readonly number[];
}) {
  const verdict = cacheVerdict(device, ourFaceIds);
  switch (verdict.kind) {
    case 'none':
      return null;
    case 'empty':
      return (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          No face photos cached on the device yet. It re-reads them at boot and about once an hour;
          a reboot forces it.
        </p>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          Cached on device: {plural(verdict.ids.length, 'photo')}{' '}
          <code className="font-mono text-xs">{verdict.ids.join(', ')}</code>
          {verdict.kind === 'ours' && '. They are yours, so it matches against your photos.'}
          {verdict.kind === 'foreign' &&
            `. Not yours: it is still using photos from PetKit's cloud. Turn proxy mode off and reboot the device to switch it to your ${plural(ourFaceIds.length, 'photo')}.`}
        </p>
      );
  }
}

/**
 * Per-device recognition. It sits beside the pets because it decides whether
 * they are matched at all: one box can be recognising while another is not.
 */
export function RecognitionSection({ devices, ourFaceIds, notify }: RecognitionSectionProps) {
  const setAi = useSetRecognition();
  return (
    <SectionCard title="On-device recognition" aside="What each device's camera matches against">
      <ul className="m-0 flex list-none flex-col p-0">
        {devices.map(d => (
          <li
            key={d.id}
            className="flex min-h-(--pk-row-height-compact) flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule py-2"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium [overflow-wrap:anywhere]">{d.name || `#${d.id}`}</span>
              <CacheLine device={d} ourFaceIds={ourFaceIds} />
            </div>
            <Switch
              label="Recognise pets"
              checked={isRecognising(d)}
              disabled={setAi.isPending}
              onCheckedChange={on => {
                setAi.mutate(
                  { deviceId: d.id, on },
                  {
                    onSuccess: () => {
                      notify('Saved');
                    },
                    onError: e => {
                      notify(errorMessage(e), true);
                    },
                  },
                );
              }}
            />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Yowling, urine pH and the other detection switches are on the Devices page.
      </p>
    </SectionCard>
  );
}
