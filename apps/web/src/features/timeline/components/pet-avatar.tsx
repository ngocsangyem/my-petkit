import { useState } from 'react';
import { serverUrl } from '@/shared/api/base-path';

/**
 * A pet's 24px round mugshot. `photoUrl` is the server-relative face route the API hands out
 * (`api/pets/{id}/faces/{fid}/photo`); a photo that fails to load leaves an empty circle rather
 * than a broken-image glyph.
 */
export function PetAvatar({ photoUrl }: { photoUrl: string | null | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!photoUrl || failed === photoUrl) {
    return <span className="tl-avatar tl-avatar--none" aria-hidden="true" />;
  }
  return (
    <img
      className="tl-avatar"
      src={serverUrl(photoUrl)}
      alt=""
      onError={() => {
        setFailed(photoUrl);
      }}
    />
  );
}
