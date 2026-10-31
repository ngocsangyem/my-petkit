import { useEffect, useRef, useState, type DragEvent } from 'react';
import { cn } from 'cn';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';
import {
  coverView,
  FACE_RULES,
  FACE_SIZE,
  JPEG_QUALITY,
  MAX_ZOOM,
  STAGE_SIZE,
  zoomPercent,
  zoomView,
  type CropView,
} from '../crop-geometry';
import {
  canvasToJpeg,
  decodeImage,
  releaseSource,
  sourceSize,
  type CropSource,
} from '../decode-image';
import { CropStage } from './crop-stage';
import { PetsModal } from './pets-modal';

/** The pet a face is being cropped for. */
export interface CropTarget {
  petId: number;
  name: string;
}

interface FaceCropperProps {
  target: CropTarget | null;
  onClose: () => void;
  /** Receives the 224x224 JPEG; the cropper closes as soon as it is encoded. */
  onSave: (petId: number, jpeg: Blob) => void;
}

/** The 224² face cropper. The photo is drawn from a file the user picks, never fetched. */
export function FaceCropper({ target, onClose, onSave }: FaceCropperProps) {
  const { t } = useTranslation(['pets', 'common']);
  const [source, setSource] = useState<CropSource | null>(null);
  const [view, setView] = useState<CropView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);

  // The decoded photo is freed rather than left to the garbage collector when
  // the sheet closes or the photo changes. (The parent keys this component by
  // pet, so a new target always starts from the picker.)
  useEffect(
    () => () => {
      releaseSource(source);
    },
    [source],
  );

  const load = async (file: File | undefined) => {
    if (!file) return;
    try {
      const decoded = await decodeImage(file);
      const { width, height } = sourceSize(decoded);
      setSource(decoded);
      setView(coverView(width, height));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crop.readFailed'));
    }
  };

  const save = async () => {
    const canvas = preview.current;
    if (!target || !canvas || !source) return;
    try {
      const jpeg = await canvasToJpeg(canvas, JPEG_QUALITY);
      onSave(target.petId, jpeg);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crop.encodeFailed'));
    }
  };

  const onDrag = (event: DragEvent<HTMLLabelElement>, over: boolean) => {
    event.preventDefault();
    setDragOver(over);
  };

  const centre = STAGE_SIZE / 2;
  return (
    <PetsModal
      open={target !== null}
      title={target ? t('crop.title', { name: target.name }) : t('crop.titleBare')}
      onClose={onClose}
      wide
    >
      {error && (
        <p className="m-0 text-sm text-negative" role="alert">
          {error}
        </p>
      )}
      {!source || !view ? (
        <label
          className={cn(
            'flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-control bg-raised p-6 text-center hover:border-data has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-data',
            dragOver && 'border-data',
          )}
          onDragEnter={e => {
            onDrag(e, true);
          }}
          onDragOver={e => {
            onDrag(e, true);
          }}
          onDragLeave={e => {
            onDrag(e, false);
          }}
          onDrop={e => {
            onDrag(e, false);
            void load(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={e => {
              void load(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <strong>{t('crop.drop')}</strong>
          <span className="text-muted-foreground">{t('crop.anyFormat')}</span>
        </label>
      ) : (
        <>
          <CropStage source={source} view={view} setView={setView} previewRef={preview} />
          <ul className="m-0 flex flex-col gap-1 pl-[18px] text-sm">
            {FACE_RULES.map(rule => (
              <li key={rule.key} className={rule.ok ? undefined : 'text-muted-foreground'}>
                <span className="sr-only">{rule.ok ? t('crop.do') : t('crop.avoid')} </span>
                {t(`crop.rules.${rule.key}`)}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="pets-crop-zoom">{t('crop.zoom')}</label>
            <input
              id="pets-crop-zoom"
              type="range"
              className="flex-1 accent-ink"
              min={100}
              max={MAX_ZOOM * 100}
              value={zoomPercent(view)}
              onChange={e => {
                const pct = Number(e.target.value);
                setView(v => (v ? zoomView(v, v.minScale * (pct / 100), centre, centre) : v));
              }}
            />
            <Button
              size="small"
              onClick={() => {
                setView(v => (v ? zoomView(v, v.minScale, centre, centre) : v));
              }}
            >
              {t('crop.reset')}
            </Button>
          </div>
          <p className="m-0 text-sm text-muted-foreground">{t('crop.hint', { size: FACE_SIZE })}</p>
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        {source && view && (
          <>
            <Button
              onClick={() => {
                setSource(null);
                setView(null);
              }}
            >
              {t('crop.chooseAnother')}
            </Button>
            <Button variant="primary" onClick={() => void save()}>
              {t('crop.use')}
            </Button>
          </>
        )}
      </div>
    </PetsModal>
  );
}
