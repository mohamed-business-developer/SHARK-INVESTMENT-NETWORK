export const MAX_SECURE_CHUNK_BYTES = 1800 as const;
export const MAX_SECURE_CHUNKS = 32 as const;
export const SECURE_MANIFEST_VERSION = 1 as const;

export interface SecureKeyValueDriver {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

export interface SupportedAuthStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface ChunkManifest {
  readonly v: 1;
  readonly count: number;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ChunkedStorageOptions {
  readonly maxChunkBytes?: number;
  readonly onCorruption?: (details: {
    readonly storageKey: string;
    readonly reason: string;
  }) => void;
}

const utf8Encoder = new TextEncoder();
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Synchronous pure-TypeScript FIPS 180-4 SHA-256 hex digest (works identically in Hermes and Node).
 */
export function sha256Hex(value: string): string {
  const input = utf8Encoder.encode(value);
  const bitLenHi = Math.floor((input.length * 8) / 0x100000000);
  const bitLenLo = (input.length * 8) >>> 0;

  const paddedLen = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return Array.from(hash)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length;
}

function metaKey(storageKey: string): string {
  return `${storageKey}__meta`;
}

function chunkKey(storageKey: string, index: number): string {
  return `${storageKey}__chunk_${index}`;
}

/**
 * Splits a string along Unicode codepoint boundaries so no chunk exceeds `maxBytes` in UTF-8.
 */
export function splitUtf8ByByteLimit(
  value: string,
  maxBytes: number = MAX_SECURE_CHUNK_BYTES,
): string[] {
  if (value.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let currentBytes = 0;

  for (const codePoint of value) {
    const charBytes = utf8Encoder.encode(codePoint).length;
    if (charBytes > maxBytes) {
      throw new Error(`Single character exceeds max chunk limit (${maxBytes} bytes)`);
    }
    if (currentBytes + charBytes > maxBytes && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = codePoint;
      currentBytes = charBytes;
    } else {
      currentChunk += codePoint;
      currentBytes += charBytes;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function parseManifest(raw: string | null): ChunkManifest | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    const v = candidate.v;
    const count = candidate.count;
    const bytes = candidate.bytes;
    const sha256 = candidate.sha256;

    if (
      v !== SECURE_MANIFEST_VERSION ||
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_SECURE_CHUNKS ||
      typeof bytes !== 'number' ||
      !Number.isInteger(bytes) ||
      bytes <= 0 ||
      typeof sha256 !== 'string' ||
      !SHA256_HEX_REGEX.test(sha256)
    ) {
      return null;
    }

    return { v: 1, count, bytes, sha256 };
  } catch {
    return null;
  }
}

function isInvalidSessionJson(storageKey: string, value: string): boolean {
  const trimmed = value.trim();
  const expectsJson =
    storageKey.includes('auth-token') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!expectsJson) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed === null;
  } catch {
    return true;
  }
}

async function safeDelete(driver: SecureKeyValueDriver, key: string): Promise<void> {
  try {
    await driver.deleteItemAsync(key);
  } catch {
    // Best-effort purge; do not allow keystore delete failures to block session reset
  }
}

/**
 * Deterministic 1800-byte chunked SecureStore adapter with SHA-256 digest,
 * per-key operation serialization, partial-write rollback, shrink cleanup, and corruption recovery.
 */
export function createChunkedSecureStorage(
  driver: SecureKeyValueDriver,
  options?: ChunkedStorageOptions,
): SupportedAuthStorage {
  const maxChunkBytes = options?.maxChunkBytes ?? MAX_SECURE_CHUNK_BYTES;
  const keyQueues = new Map<string, Promise<unknown>>();

  const enqueueKeyOperation = <T>(storageKey: string, task: () => Promise<T>): Promise<T> => {
    const previous = keyQueues.get(storageKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    const sentinel = next.catch(() => undefined);
    keyQueues.set(storageKey, sentinel);
    void sentinel.finally(() => {
      if (keyQueues.get(storageKey) === sentinel) {
        keyQueues.delete(storageKey);
      }
    });
    return next;
  };

  const purgeAllChunks = async (storageKey: string, knownCount?: number): Promise<void> => {
    let sweepLimit = knownCount ?? 0;
    if (sweepLimit === 0) {
      try {
        const existingManifest = parseManifest(await driver.getItemAsync(metaKey(storageKey)));
        sweepLimit = existingManifest?.count ?? MAX_SECURE_CHUNKS;
      } catch {
        sweepLimit = MAX_SECURE_CHUNKS;
      }
    }

    await safeDelete(driver, metaKey(storageKey));
    await safeDelete(driver, storageKey);
    const boundedSweep = Math.min(Math.max(sweepLimit, 0), MAX_SECURE_CHUNKS);
    await Promise.all(
      Array.from({ length: boundedSweep }, (_, i) => safeDelete(driver, chunkKey(storageKey, i))),
    );
  };

  const handleCorruption = async (
    storageKey: string,
    reason: string,
    knownCount?: number,
  ): Promise<null> => {
    await purgeAllChunks(storageKey, knownCount);
    options?.onCorruption?.({ storageKey, reason });
    return null;
  };

  return {
    getItem(storageKey: string): Promise<string | null> {
      return enqueueKeyOperation(storageKey, async () => {
        try {
          const rawMeta = await driver.getItemAsync(metaKey(storageKey));

          if (rawMeta === null) {
            const firstOrphanChunk = await driver.getItemAsync(chunkKey(storageKey, 0));
            if (firstOrphanChunk !== null) {
              return await handleCorruption(storageKey, 'interrupted_write', MAX_SECURE_CHUNKS);
            }

            const legacyValue = await driver.getItemAsync(storageKey);
            if (legacyValue === null) {
              return null;
            }
            if (isInvalidSessionJson(storageKey, legacyValue)) {
              return await handleCorruption(storageKey, 'corrupt_legacy_json');
            }
            return legacyValue;
          }

          const manifest = parseManifest(rawMeta);
          if (!manifest) {
            return await handleCorruption(storageKey, 'invalid_manifest', MAX_SECURE_CHUNKS);
          }

          const parts: string[] = [];
          for (let i = 0; i < manifest.count; i += 1) {
            const part = await driver.getItemAsync(chunkKey(storageKey, i));
            if (part === null) {
              return await handleCorruption(storageKey, 'missing_chunk', MAX_SECURE_CHUNKS);
            }
            parts.push(part);
          }

          const assembled = parts.join('');
          if (utf8ByteLength(assembled) !== manifest.bytes) {
            return await handleCorruption(storageKey, 'byte_length_mismatch', MAX_SECURE_CHUNKS);
          }

          if (sha256Hex(assembled) !== manifest.sha256) {
            return await handleCorruption(storageKey, 'digest_mismatch', MAX_SECURE_CHUNKS);
          }

          if (isInvalidSessionJson(storageKey, assembled)) {
            return await handleCorruption(storageKey, 'corrupt_session_json', MAX_SECURE_CHUNKS);
          }

          return assembled;
        } catch {
          return await handleCorruption(storageKey, 'keystore_read_error', MAX_SECURE_CHUNKS);
        }
      });
    },

    setItem(storageKey: string, value: string): Promise<void> {
      return enqueueKeyOperation(storageKey, async () => {
        if (value.length === 0) {
          await purgeAllChunks(storageKey, MAX_SECURE_CHUNKS);
          return;
        }

        const chunks = splitUtf8ByByteLimit(value, maxChunkBytes);
        if (chunks.length === 0 || chunks.length > MAX_SECURE_CHUNKS) {
          throw new Error(
            `Chunk count (${chunks.length}) exceeds MAX_SECURE_CHUNKS (${MAX_SECURE_CHUNKS})`,
          );
        }

        let previousCount = 0;
        try {
          const existingManifest = parseManifest(await driver.getItemAsync(metaKey(storageKey)));
          previousCount = existingManifest?.count ?? MAX_SECURE_CHUNKS;
        } catch {
          previousCount = MAX_SECURE_CHUNKS;
        }

        // Invalidate previous manifest FIRST so any crash mid-write can never restore mixed chunks.
        await safeDelete(driver, metaKey(storageKey));

        try {
          for (let i = 0; i < chunks.length; i += 1) {
            const chunk = chunks[i];
            if (chunk !== undefined) {
              await driver.setItemAsync(chunkKey(storageKey, i), chunk);
            }
          }

          const nextManifest: ChunkManifest = {
            v: SECURE_MANIFEST_VERSION,
            count: chunks.length,
            bytes: utf8ByteLength(value),
            sha256: sha256Hex(value),
          };
          await driver.setItemAsync(metaKey(storageKey), JSON.stringify(nextManifest));
        } catch (err) {
          await purgeAllChunks(storageKey, Math.max(previousCount, chunks.length));
          throw err;
        }

        for (let i = chunks.length; i < previousCount; i += 1) {
          await safeDelete(driver, chunkKey(storageKey, i));
        }
        await safeDelete(driver, storageKey);
      });
    },

    removeItem(storageKey: string): Promise<void> {
      return enqueueKeyOperation(storageKey, async () => {
        await purgeAllChunks(storageKey, MAX_SECURE_CHUNKS);
      });
    },
  };
}
