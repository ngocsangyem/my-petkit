import { useState } from 'react';
import { cn } from 'cn';
import { serverUrl } from '@/shared/api/base-path';

/** Avatar sizes in use: the strip lane (24), a chip (22), a dialog row (36) and a list row (40). */
export type PetAvatarSize = 22 | 24 | 36 | 40;

const SIZE = new Map<PetAvatarSize, string>([
  [22, 'size-5.5'],
  [24, 'size-6'],
  [36, 'size-9'],
  [40, 'size-10'],
]);

/**
 * A pet's round mugshot. `photoUrl` is the server-relative face route the API hands out
 * (`api/pets/{id}/faces/{fid}/photo`); a photo that fails to load leaves an empty circle rather
 * than a broken-image glyph.
 */
export function PetAvatar({
  photoUrl,
  size = 24,
}: {
  photoUrl: string | null | undefined;
  size?: PetAvatarSize;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!photoUrl || failed === photoUrl) {
    return (
      <span
        className={cn('inline-block flex-none rounded-full bg-track', SIZE.get(size))}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      className={cn('flex-none rounded-full object-cover', SIZE.get(size))}
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
