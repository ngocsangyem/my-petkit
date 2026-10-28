/** A decoded photo the cropper can draw. */
export type CropSource = ImageBitmap | HTMLImageElement;

/** Natural size of a decoded photo. */
export function sourceSize(source: CropSource): { width: number; height: number } {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

/** Free the decoded pixels now: a phone photo is tens of megabytes once decoded. */
export function releaseSource(source: CropSource | null): void {
  if (source && !(source instanceof HTMLImageElement)) source.close();
}

/**
 * Decode a picked file. `createImageBitmap` honours the EXIF orientation, which
 * matters because a phone portrait is stored landscape plus a rotation tag and
 * decoded naively the cat comes out sideways. The `<img>` fallback (a blob: URL,
 * allowed by the CSP) covers browsers without the option; there the decoder
 * applies the tag itself. The file is read locally and never fetched.
 */
export async function decodeImage(file: File): Promise<CropSource> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => {
        resolve();
      });
      img.addEventListener('error', () => {
        reject(new Error('Could not read that image.'));
      });
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Could not read that image.');
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The preview canvas as the JPEG the device will receive. */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the crop.'));
      },
      'image/jpeg',
      quality,
    );
  });
}
