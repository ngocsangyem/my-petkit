import { useState } from 'react';
import { cn } from 'cn';
import { serverUrl } from '@/shared/api/base-path';

/** Avatar sizes in use: a chip (22), the strip lane or a pet chip (24), a dialog row (36), a list row (40). */
export type PetAvatarSize = 22 | 24 | 36 | 40;

const SIZE = new Map<PetAvatarSize, string>([
  [22, 'size-5.5'],
  [24, 'size-6'],
  [36, 'size-9'],
  [40, 'size-10'],
]);

const CIRCLE = 'flex-none rounded-full';

/** Props for {@link PetAvatar}. */
export interface PetAvatarProps {
  /** Server-relative face route the API hands out (`api/pets/{id}/faces/{fid}/photo`). */
  photoUrl: string | null | undefined;
  size?: PetAvatarSize;
}

/**
 * A pet's round mugshot. A missing photo, or one that fails to load, leaves an empty `track`
 * circle rather than a broken-image glyph. Decorative: the pet's name is always beside it.
 */
export function PetAvatar({ photoUrl, size = 24 }: PetAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!photoUrl || failed === photoUrl) {
    return (
      <span className={cn('inline-block bg-track', CIRCLE, SIZE.get(size))} aria-hidden="true" />
    );
  }
  return (
    <img
      className={cn('object-cover', CIRCLE, SIZE.get(size))}
      src={serverUrl(photoUrl)}
      alt=""
      width={size}
      height={size}
      onError={() => {
        setFailed(photoUrl);
      }}
    />
  );
}

/** The "?" circle standing in for a cat nobody recognised (a timeline row, an unbound identity). */
export function UnknownPetAvatar({ size = 40 }: { size?: PetAvatarSize }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center bg-track text-muted-foreground',
        CIRCLE,
        SIZE.get(size),
      )}
      aria-hidden="true"
    >
      ?
    </span>
  );
}
