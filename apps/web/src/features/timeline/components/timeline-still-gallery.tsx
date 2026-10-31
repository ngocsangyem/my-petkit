import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mediaUrl } from '@/shared/api/base-path';
import { Button, CaptionPill, Icon } from '@/shared/ui';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/shadcn/dialog';

/**
 * A media-root image that removes itself when it fails to load. A thumbnail can be asked for
 * before its file exists (the live refresh brings it back); a 404 must not leave a broken glyph.
 */
export function MediaImage({
  path,
  thumb,
  className,
}: {
  path: string;
  thumb: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === path) return null;
  return (
    <img
      className={className}
      src={mediaUrl(path, thumb)}
      alt=""
      onError={() => {
        setFailed(path);
      }}
    />
  );
}

export interface StillGroup {
  title: string;
  paths: string[];
}

/**
 * Waste and health captures: one square photo per role with its name and count on the dark
 * caption pill, and a click to open the gallery.
 */
export function StillTiles({
  groups,
  onOpen,
}: {
  groups: readonly StillGroup[];
  onOpen: (paths: string[], title: string) => void;
}) {
  const { t } = useTranslation('timeline');
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{t('stills.photos')}</span>
      <div className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-3">
        {groups.map(g => (
          <button
            key={g.title}
            type="button"
            className="relative block aspect-square cursor-zoom-in overflow-hidden rounded-lg border-0 bg-ink p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-ground"
            aria-label={t('stills.tile', { title: g.title, count: g.paths.length })}
            onClick={() => {
              onOpen(g.paths, g.title);
            }}
          >
            {g.paths[0] && (
              <MediaImage path={g.paths[0]} thumb className="size-full object-cover" />
            )}
            <CaptionPill className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate">
              {g.title} · {g.paths.length}
            </CaptionPill>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface StillGalleryProps {
  /** The pictures to show; `null` closes the gallery. */
  gallery: { paths: readonly string[]; title: string } | null;
  onClose: () => void;
}

/** The open gallery's body; it unmounts on close, so the next open starts at the first picture. */
function GalleryBody({
  paths,
  title,
  onClose,
}: {
  paths: readonly string[];
  title: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['timeline', 'common']);
  const [index, setIndex] = useState(0);
  const count = paths.length;
  const current = paths[Math.min(index, count - 1)];
  const step = (n: number) => {
    setIndex(i => (i + n + count) % count);
  };
  return (
    <>
      <div className="flex items-center gap-2.5">
        <DialogTitle className="flex-1 text-base leading-normal font-semibold">{title}</DialogTitle>
        <Button
          size="small"
          aria-label={t('stills.previous')}
          disabled={count < 2}
          onClick={() => {
            step(-1);
          }}
        >
          <Icon name="back" />
        </Button>
        <span className="text-muted-foreground">
          {t('stills.position', { index: Math.min(index, count - 1) + 1, count })}
        </span>
        <Button
          size="small"
          aria-label={t('stills.next')}
          disabled={count < 2}
          onClick={() => {
            step(1);
          }}
        >
          <Icon name="forward" />
        </Button>
        <Button size="small" variant="text" onClick={onClose}>
          {t('common:close')}
        </Button>
      </div>
      {current && (
        <MediaImage
          key={current}
          path={current}
          thumb={false}
          className="max-h-[70vh] w-full rounded-md bg-ink object-contain dark:bg-ground"
        />
      )}
    </>
  );
}

/**
 * One picture at a time with "n of m". The true total is counted here from the group: a file
 * name carries only a bare index because the total is unknown when the device uploads it.
 * Escape and the backdrop close it, and focus goes back to the tile that opened it.
 */
export function StillGallery({ gallery, onClose }: StillGalleryProps) {
  // Kept while the closing transition runs, so the picture does not vanish mid-fade.
  const [shown, setShown] = useState(gallery);
  if (gallery && gallery !== shown) setShown(gallery);
  return (
    <Dialog
      open={gallery !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="gap-2 sm:max-w-240">
        {shown && <GalleryBody paths={shown.paths} title={shown.title} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
