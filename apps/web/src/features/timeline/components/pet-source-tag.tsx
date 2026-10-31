import { useTranslation } from 'react-i18next';
import { Pill } from '@/shared/ui';
import type { TimelineSession } from '../timeline-model';
import { petSourceTag } from '../visit-pet-model';

/** "by weight" as a neutral pill, or a muted "not recognised" / "just passing", beside a visit. */
export function PetSourceTag({ session }: { session: TimelineSession }) {
  // Subscribes so the tag's words follow a language change.
  useTranslation('timeline');
  const tag = petSourceTag(session);
  if (!tag) return null;
  if (tag.kind === 'badge') return <Pill>{tag.label}</Pill>;
  return <span className="text-sm text-muted-foreground">{tag.label}</span>;
}
