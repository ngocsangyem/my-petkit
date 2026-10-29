import QRCode from 'qrcode';

/** A SHA-256 hex fingerprint as people compare it: upper case, groups of four. */
export function groupFingerprint(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, '').toUpperCase();
  return (clean.match(/.{1,4}/g) ?? []).join(' ');
}

/** `m:ss` left until `expiresAt` (Unix seconds), never negative. */
export function countdown(expiresAt: number, nowMs: number): string {
  const left = Math.max(0, Math.ceil(expiresAt - nowMs / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** The QR code as one SVG path (one 1×1 square per dark module) plus its side length. */
export function qrPath(text: string): { size: number; path: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const parts: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
    }
  }
  return { size: modules.size, path: parts.join('') };
}
