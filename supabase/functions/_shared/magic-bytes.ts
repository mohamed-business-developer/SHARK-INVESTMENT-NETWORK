/**
 * Server-side magic-byte signature validation for uploaded storage objects (docs/SECURITY.md §5.2).
 * Prevents spoofed MIME headers and stored SVG/script uploads.
 */

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const; // PK.. (PPTX / XLSX OOXML)

function startsWithBytes(header: Uint8Array, signature: readonly number[]): boolean {
  if (header.length < signature.length) {
    return false;
  }
  return signature.every((byte, idx) => header[idx] === byte);
}

export function verifyMagicBytes(header: Uint8Array, claimedMimeType: string): boolean {
  const textSample = new TextDecoder().decode(header.slice(0, 64)).toLowerCase();
  if (textSample.includes('<svg') || textSample.includes('<script')) {
    return false;
  }

  switch (claimedMimeType) {
    case 'application/pdf':
      return startsWithBytes(header, PDF_MAGIC);
    case 'image/png':
      return startsWithBytes(header, PNG_MAGIC);
    case 'image/jpeg':
      return startsWithBytes(header, JPEG_MAGIC);
    case 'image/webp': {
      if (header.length < 12) return false;
      const riff = new TextDecoder().decode(header.slice(0, 4));
      const webp = new TextDecoder().decode(header.slice(8, 12));
      return riff === 'RIFF' && webp === 'WEBP';
    }
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return startsWithBytes(header, ZIP_MAGIC);
    default:
      return false;
  }
}
