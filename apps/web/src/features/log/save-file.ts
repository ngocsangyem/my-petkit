/** Hand a blob to the browser as a download named `filename`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking at once can cancel the download in some browsers; a second is
  // plenty for the navigation to have started.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** A filesystem-safe stamp of now, e.g. `2026-10-29T08-12-07`. */
export function fileStamp(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
