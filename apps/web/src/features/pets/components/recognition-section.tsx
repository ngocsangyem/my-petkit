import { Trans, useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { SectionCard, Switch } from '@/shared/ui';
import { useSetRecognition } from '../api';
import { cacheVerdict, countText, isRecognising, type DeviceDetail } from '../pet-model';

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
  const { t } = useTranslation('pets');
  const verdict = cacheVerdict(device, ourFaceIds);
  switch (verdict.kind) {
    case 'none':
      return null;
    case 'empty':
      return (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {t('recognition.cacheEmpty')}
        </p>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <Trans
            t={t}
            i18nKey={
              verdict.kind === 'ours'
                ? 'recognition.cachedOurs'
                : verdict.kind === 'foreign'
                  ? 'recognition.cachedForeign'
                  : 'recognition.cached'
            }
            values={{
              photos: countText('photo', verdict.ids.length),
              ids: verdict.ids.join(', '),
              ours: countText('photo', ourFaceIds.length),
            }}
            components={{ ids: <code className="font-mono text-xs" /> }}
          />
        </p>
      );
  }
}

/**
 * Per-device recognition. It sits beside the pets because it decides whether
 * they are matched at all: one box can be recognising while another is not.
 */
export function RecognitionSection({ devices, ourFaceIds, notify }: RecognitionSectionProps) {
  const { t } = useTranslation('pets');
  const setAi = useSetRecognition();
  return (
    <SectionCard title={t('recognition.title')} aside={t('recognition.aside')}>
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
              label={t('recognition.switch')}
              checked={isRecognising(d)}
              disabled={setAi.isPending}
              onCheckedChange={on => {
                setAi.mutate(
                  { deviceId: d.id, on },
                  {
                    onSuccess: () => {
                      notify(t('recognition.saved'));
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
      <p className="text-sm text-muted-foreground">{t('recognition.detectionNote')}</p>
    </SectionCard>
  );
}
