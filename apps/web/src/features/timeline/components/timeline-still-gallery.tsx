import { useState } from 'react';
import { mediaUrl } from '@/shared/api/base-path';
import { Button, Icon } from '@/shared/ui';
import { AspectRatio } from '@/shared/ui/shadcn/aspect-ratio';
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

/** Waste and health captures: one tile per role, its count, and a click to open the gallery. */
export function StillTiles({
  groups,
  onOpen,
}: {
  groups: readonly StillGroup[];
  onOpen: (paths: string[], title: string) => void;
}) {
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Waste and health captures</span>
      <div className="flex flex-wrap gap-2">
        {groups.map(g => (
          <button
            key={g.title}
            type="button"
            className="flex cursor-zoom-in flex-col gap-1 border-0 bg-transparent p-0 text-left text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`${g.title}, ${String(g.paths.length)} picture${g.paths.length === 1 ? '' : 's'}`}
            onClick={() => {
              onOpen(g.paths, g.title);
            }}
          >
            <AspectRatio ratio={4 / 3} className="block w-22 overflow-hidden rounded-md bg-rule">
              {g.paths[0] && (
                <MediaImage path={g.paths[0]} thumb className="size-full object-contain" />
              )}
              <span className="absolute right-1 bottom-1 min-w-5 rounded-full bg-background px-1.5 text-center text-xs text-foreground">
                {g.paths.length}
              </span>
            </AspectRatio>
            <span className="text-xs">{g.title}</span>
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
          aria-label="Previous picture"
          disabled={count < 2}
          onClick={() => {
            step(-1);
          }}
        >
          <Icon name="chevron" className="rotate-90" />
        </Button>
        <span className="text-muted-foreground">
          {Math.min(index, count - 1) + 1} of {count}
        </span>
        <Button
          size="small"
          aria-label="Next picture"
          disabled={count < 2}
          onClick={() => {
            step(1);
          }}
        >
          <Icon name="chevron" className="-rotate-90" />
        </Button>
        <Button size="small" variant="text" onClick={onClose}>
          Close
        </Button>
      </div>
      {current && (
        <MediaImage
          key={current}
          path={current}
          thumb={false}
          className="max-h-[70vh] w-full rounded-lg bg-ink object-contain dark:bg-ground"
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
