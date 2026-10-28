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
        <p className="pets-small pets-muted">
          No face photos cached on the device yet. It re-reads them at boot and about once an hour;
          a reboot forces it.
        </p>
      );
    default:
      return (
        <p className="pets-small pets-muted">
          Cached on device: {plural(verdict.ids.length, 'photo')}{' '}
          <code className="pets-mono">{verdict.ids.join(', ')}</code>
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
      <ul className="pets-recognition">
        {devices.map(d => (
          <li key={d.id} className="pets-recognition__row">
            <div className="pets-recognition__text">
              <span className="pets-recognition__name">{d.name || `#${d.id}`}</span>
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
      <p className="pets-small pets-muted">
        Yowling, urine pH and the other detection switches are on the Devices page.
      </p>
    </SectionCard>
  );
}
