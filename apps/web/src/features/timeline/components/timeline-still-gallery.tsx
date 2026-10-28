import { useRef, useState } from 'react';
import { mediaUrl } from '@/shared/api/base-path';
import { Button, Icon, useModalFocus } from '@/shared/ui';

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
    <div className="tl-stills">
      <span className="tl-label">Waste and health captures</span>
      <div className="tl-stills__row">
        {groups.map(g => (
          <button
            key={g.title}
            type="button"
            className="tl-still"
            aria-label={`${g.title}, ${String(g.paths.length)} picture${g.paths.length === 1 ? '' : 's'}`}
            onClick={() => {
              onOpen(g.paths, g.title);
            }}
          >
            <span className="tl-still__frame">
              {g.paths[0] && <MediaImage path={g.paths[0]} thumb className="tl-still__img" />}
              <span className="tl-still__count">{g.paths.length}</span>
            </span>
            <span className="tl-still__caption">{g.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface StillGalleryProps {
  paths: readonly string[];
  title: string;
  onClose: () => void;
}

/**
 * One picture at a time with "n of m". The true total is counted here from the group: a file
 * name carries only a bare index because the total is unknown when the device uploads it.
 */
export function StillGallery({ paths, title, onClose }: StillGalleryProps) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, { open: true, onEscape: onClose });
  const count = paths.length;
  const current = paths[Math.min(index, count - 1)];
  const step = (n: number) => {
    setIndex(i => (i + n + count) % count);
  };
  return (
    <div className="ui-dialog-layer">
      <div className="ui-dialog-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        className="ui-dialog tl-gallery"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="tl-gallery__head">
          <b>{title}</b>
          <span className="tl-grow" />
          <Button
            size="small"
            aria-label="Previous picture"
            disabled={count < 2}
            onClick={() => {
              step(-1);
            }}
          >
            <Icon name="chevron" className="tl-icon-btn__prev" />
          </Button>
          <span className="tl-muted tl-num">
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
            <Icon name="chevron" className="tl-icon-btn__next" />
          </Button>
          <Button size="small" variant="text" onClick={onClose}>
            Close
          </Button>
        </div>
        {current && (
          <MediaImage key={current} path={current} thumb={false} className="tl-gallery__img" />
        )}
      </div>
    </div>
  );
}
