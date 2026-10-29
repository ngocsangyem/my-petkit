import { useEffect, useRef, useState, type DragEvent } from 'react';
import { cn } from 'cn';
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
      setError(e instanceof Error ? e.message : 'Could not read that image.');
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
      setError(e instanceof Error ? e.message : 'Could not encode the crop.');
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
      title={target ? `Add a face photo of ${target.name}` : 'Add a face photo'}
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
            'flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-control bg-raised p-6 text-center hover:border-data focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-data',
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
          <strong>Drop a photo here, or choose one</strong>
          <span className="text-muted-foreground">Any image format your browser can open</span>
        </label>
      ) : (
        <>
          <CropStage source={source} view={view} setView={setView} previewRef={preview} />
          <ul className="m-0 flex flex-col gap-1 pl-[18px] text-sm">
            {FACE_RULES.map(rule => (
              <li key={rule.text} className={rule.ok ? undefined : 'text-muted-foreground'}>
                <span className="sr-only">{rule.ok ? 'Do: ' : 'Avoid: '}</span>
                {rule.text}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="pets-crop-zoom">Zoom</label>
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
              Reset
            </Button>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            Zoom in until the head fills the outline, closer than feels right. Saved at {FACE_SIZE}{' '}
            × {FACE_SIZE}, sent as JPEG.
          </p>
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        {source && view && (
          <>
            <Button
              onClick={() => {
                setSource(null);
                setView(null);
              }}
            >
              Choose another
            </Button>
            <Button variant="primary" onClick={() => void save()}>
              Use this photo
            </Button>
          </>
        )}
      </div>
    </PetsModal>
  );
}
