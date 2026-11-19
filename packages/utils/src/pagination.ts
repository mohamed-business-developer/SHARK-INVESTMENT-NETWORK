import type { CursorPageResponse, KeysetCursor } from '@shark/shared-types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8ToBytes(str: string): number[] {
  const utf8 = encodeURIComponent(str);
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i += 1) {
    const ch = utf8.charAt(i);
    if (ch === '%') {
      const hex = utf8.slice(i + 1, i + 3);
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return bytes;
}

function bytesToUtf8(bytes: readonly number[]): string {
  let encoded = '';
  for (const byte of bytes) {
    encoded += `%${byte.toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(encoded);
}

function toBase64Url(input: string): string {
  const bytes = utf8ToBytes(input);
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;

    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_URL_CHARS.charAt((triplet >> 18) & 63);
    output += BASE64_URL_CHARS.charAt((triplet >> 12) & 63);
    if (hasB1) {
      output += BASE64_URL_CHARS.charAt((triplet >> 6) & 63);
    }
    if (hasB2) {
      output += BASE64_URL_CHARS.charAt(triplet & 63);
    }
  }
  return output;
}

function fromBase64Url(encoded: string): string {
  if (!/^[A-Za-z0-9\-_]+$/.test(encoded)) {
    throw new Error('Invalid base64url cursor');
  }
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const c0 = BASE64_URL_CHARS.indexOf(encoded.charAt(i));
    const c1 = BASE64_URL_CHARS.indexOf(encoded.charAt(i + 1));
    const c2Char = encoded.charAt(i + 2);
    const c3Char = encoded.charAt(i + 3);
    const c2 = c2Char ? BASE64_URL_CHARS.indexOf(c2Char) : 0;
    const c3 = c3Char ? BASE64_URL_CHARS.indexOf(c3Char) : 0;

    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
      throw new Error('Invalid base64url character');
    }

    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((triplet >> 16) & 255);
    if (c2Char) {
      bytes.push((triplet >> 8) & 255);
    }
    if (c3Char) {
      bytes.push(triplet & 255);
    }
  }
  return bytesToUtf8(bytes);
}

export function encodeCursor(cursor: KeysetCursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

export function decodeCursor(rawCursor: string | null | undefined): KeysetCursor | null {
  if (!rawCursor || rawCursor.length > 512) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(rawCursor)) as Record<string, unknown>;
    if (
      typeof parsed.ts !== 'string' ||
      Number.isNaN(Date.parse(parsed.ts)) ||
      typeof parsed.id !== 'string' ||
      !UUID_REGEX.test(parsed.id)
    ) {
      return null;
    }
    if (parsed.featured !== undefined && typeof parsed.featured !== 'boolean') {
      return null;
    }
    return {
      ts: parsed.ts,
      id: parsed.id,
      ...(typeof parsed.featured === 'boolean' ? { featured: parsed.featured } : {}),
    };
  } catch {
    return null;
  }
}

export function buildCursorPage<T>(
  rows: readonly T[],
  limit: number,
  getCursor: (item: T) => KeysetCursor,
): CursorPageResponse<T> {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const hasNextPage = rows.length > safeLimit;
  const items = hasNextPage ? rows.slice(0, safeLimit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor = hasNextPage && lastItem ? encodeCursor(getCursor(lastItem)) : null;

  return {
    items,
    nextCursor,
    hasNextPage,
  };
}
