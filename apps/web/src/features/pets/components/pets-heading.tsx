import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { Button, Icon, PageHeader } from '@/shared/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/shadcn/tooltip';
import { listNames, petStatus, type DeviceDetail, type Pet } from '../pet-model';

interface PetsHeadingProps {
  pets: readonly Pet[] | null;
  aiDetails: readonly DeviceDetail[];
  unboundCount: number;
  /** Shows "Import from PetKit account" (there is an AI-capable device). */
  canImport: boolean;
  /** Shows "Add a pet" (at least one device is recognising). */
  canAdd: boolean;
  /** Why "Add a pet" is disabled (every box is full), or null when it is not. */
  addBlocked?: string | null;
  onImport: () => void;
  onAdd: () => void;
}

/** The one finding line: who is recognised, who is waiting, and what has no pet yet. */
export function findingLine(
  pets: readonly Pet[],
  aiDetails: readonly DeviceDetail[],
  unboundCount: number,
): string {
  const statuses = pets.map(p => ({ name: p.name, s: petStatus(p, aiDetails) }));
  const loaded = statuses.filter(x => x.s.loaded).map(x => x.name);
  const waiting = statuses.filter(x => x.s.waiting).map(x => x.name);
  const parts: string[] = [];
  if (loaded.length) {
    parts.push(
      i18n.t('pets:heading.recognised', { names: listNames(loaded), count: loaded.length }),
    );
  }
  if (waiting.length) {
    parts.push(
      i18n.t('pets:heading.waiting', { names: listNames(waiting), count: waiting.length }),
    );
  }
  if (unboundCount) {
    parts.push(i18n.t('pets:heading.unbound', { count: unboundCount }));
  }
  return parts.join(' ');
}

export function PetsHeading({
  pets,
  aiDetails,
  unboundCount,
  canImport,
  canAdd,
  addBlocked = null,
  onImport,
  onAdd,
}: PetsHeadingProps) {
  const { t } = useTranslation('pets');
  const add = (
    <Button variant="primary" onClick={onAdd} disabled={addBlocked !== null}>
      <Icon name="plus" size={16} strokeWidth={2} />
      {t('heading.addPet')}
    </Button>
  );
  const finding = pets
    ? [t('heading.pets', { count: pets.length }), findingLine(pets, aiDetails, unboundCount)]
        .filter(Boolean)
        .join(' ')
    : '';
  return (
    <PageHeader
      title={t('title')}
      finding={finding || undefined}
      actions={
        canImport || canAdd ? (
          <>
            {canImport && (
              <Button onClick={onImport}>
                <Icon name="cloud" size={16} />
                {t('heading.import')}
              </Button>
            )}
            {canAdd &&
              (addBlocked === null ? (
                add
              ) : (
                // A disabled button takes no pointer events, so a focusable wrapper holds the tip.
                <Tooltip>
                  <TooltipTrigger render={<span tabIndex={0} />}>{add}</TooltipTrigger>
                  <TooltipContent>{addBlocked}</TooltipContent>
                </Tooltip>
              ))}
          </>
        ) : undefined
      }
    />
  );
}
