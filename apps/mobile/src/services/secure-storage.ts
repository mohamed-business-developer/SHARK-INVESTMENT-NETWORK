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
}

export interface ChunkedStorageOptions {
  readonly maxChunkBytes?: number;
  readonly onCorruption?: (details: {
    readonly storageKey: string;
    readonly reason: string;
  }) => void;
}

const utf8Encoder = new TextEncoder();

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

    if (
      v !== SECURE_MANIFEST_VERSION ||
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_SECURE_CHUNKS ||
      typeof bytes !== 'number' ||
      !Number.isInteger(bytes) ||
      bytes <= 0
    ) {
      return null;
    }

    return { v: 1, count, bytes };
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
 * Deterministic 1800-byte chunked SecureStore adapter with shrink cleanup and corruption recovery.
 */
export function createChunkedSecureStorage(
  driver: SecureKeyValueDriver,
  options?: ChunkedStorageOptions,
): SupportedAuthStorage {
  const maxChunkBytes = options?.maxChunkBytes ?? MAX_SECURE_CHUNK_BYTES;

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
    for (let i = 0; i < Math.min(sweepLimit, MAX_SECURE_CHUNKS); i += 1) {
      await safeDelete(driver, chunkKey(storageKey, i));
    }
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
    async getItem(storageKey: string): Promise<string | null> {
      try {
        const rawMeta = await driver.getItemAsync(metaKey(storageKey));

        if (rawMeta === null) {
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

        if (isInvalidSessionJson(storageKey, assembled)) {
          return await handleCorruption(storageKey, 'corrupt_session_json', MAX_SECURE_CHUNKS);
        }

        return assembled;
      } catch {
        return await handleCorruption(storageKey, 'keystore_read_error', MAX_SECURE_CHUNKS);
      }
    },

    async setItem(storageKey: string, value: string): Promise<void> {
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
        previousCount = existingManifest?.count ?? 0;
      } catch {
        previousCount = MAX_SECURE_CHUNKS;
      }

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
      };
      await driver.setItemAsync(metaKey(storageKey), JSON.stringify(nextManifest));

      for (let i = chunks.length; i < previousCount; i += 1) {
        await safeDelete(driver, chunkKey(storageKey, i));
      }
      await safeDelete(driver, storageKey);
    },

    async removeItem(storageKey: string): Promise<void> {
      await purgeAllChunks(storageKey);
    },
  };
}
