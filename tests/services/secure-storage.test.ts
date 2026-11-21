import { describe, expect, it, vi } from 'vitest';
import {
  createChunkedSecureStorage,
  MAX_SECURE_CHUNK_BYTES,
  sha256Hex,
  utf8ByteLength,
  type SecureKeyValueDriver,
} from '../../apps/mobile/src/services/secure-storage';

interface MockKeystoreOptions {
  readonly enforce2048Limit?: boolean;
  readonly throwOnReadKeys?: readonly string[];
  readonly shouldFailWrite?: (key: string) => boolean;
  readonly setDelayMs?: number;
}

function createSimulatedKeystore(options?: MockKeystoreOptions) {
  const store = new Map<string, string>();

  const driver: SecureKeyValueDriver = {
    async getItemAsync(key: string): Promise<string | null> {
      if (options?.throwOnReadKeys?.includes(key)) {
        throw new Error('Keystore decryption failed');
      }
      return store.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string): Promise<void> {
      if (options?.setDelayMs) {
        await new Promise((r) => setTimeout(r, options.setDelayMs));
      }
      if (options?.shouldFailWrite?.(key)) {
        throw new Error(`Simulated partial write crash on ${key}`);
      }
      if (options?.enforce2048Limit !== false && utf8ByteLength(value) > 2048) {
        throw new Error(`Value for ${key} exceeds SecureStore 2048-byte limit`);
      }
      store.set(key, value);
    },
    async deleteItemAsync(key: string): Promise<void> {
      store.delete(key);
    },
  };

  return { store, driver };
}

describe('Mobile chunked SecureStore adapter (T5-04 / P5-U01)', () => {
  const STORAGE_KEY = 'sb-shark-auth-token';

  it('persists, reads, and removes a 4.5 KB+ bilingual session across <= 1800-byte chunks', async () => {
    const { store, driver } = createSimulatedKeystore({ enforce2048Limit: true });
    const adapter = createChunkedSecureStorage(driver);

    const largeSession = JSON.stringify({
      access_token: `jwt_header.${'A'.repeat(2100)}.sig`,
      refresh_token: `ref_${'B'.repeat(900)}`,
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: '11111111-1111-4111-8111-111111111101',
        email: 'investor@shark.test',
        full_name_ar: 'مستثمر استراتيجي '.repeat(80),
      },
    });

    expect(utf8ByteLength(largeSession)).toBeGreaterThan(4500);

    await adapter.setItem(STORAGE_KEY, largeSession);

    const rawMeta = store.get(`${STORAGE_KEY}__meta`);
    expect(rawMeta).toBeDefined();
    const meta = JSON.parse(rawMeta ?? '{}') as { v: number; count: number; bytes: number };
    expect(meta.v).toBe(1);
    expect(meta.count).toBeGreaterThanOrEqual(3);
    expect(meta.bytes).toBe(utf8ByteLength(largeSession));

    for (let i = 0; i < meta.count; i += 1) {
      const chunk = store.get(`${STORAGE_KEY}__chunk_${i}`) ?? '';
      expect(utf8ByteLength(chunk)).toBeLessThanOrEqual(MAX_SECURE_CHUNK_BYTES);
    }

    expect(await adapter.getItem(STORAGE_KEY)).toBe(largeSession);

    await adapter.removeItem(STORAGE_KEY);
    expect(store.size).toBe(0);
    expect(await adapter.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes trailing obsolete chunks cleanly when overwriting with a smaller session', async () => {
    const { store, driver } = createSimulatedKeystore();
    const adapter = createChunkedSecureStorage(driver);

    const largeSession = JSON.stringify({ token: 'X'.repeat(4200) });
    await adapter.setItem(STORAGE_KEY, largeSession);
    expect(store.has(`${STORAGE_KEY}__chunk_2`)).toBe(true);

    const compactSession = JSON.stringify({ token: 'short_token' });
    await adapter.setItem(STORAGE_KEY, compactSession);

    expect(store.has(`${STORAGE_KEY}__chunk_0`)).toBe(true);
    expect(store.has(`${STORAGE_KEY}__chunk_1`)).toBe(false);
    expect(store.has(`${STORAGE_KEY}__chunk_2`)).toBe(false);
    expect(await adapter.getItem(STORAGE_KEY)).toBe(compactSession);
  });

  it('reads legacy single-key values and cleans legacy key upon next chunked write', async () => {
    const { store, driver } = createSimulatedKeystore();
    const adapter = createChunkedSecureStorage(driver);
    const legacyPayload = JSON.stringify({ access_token: 'legacy_tok' });

    store.set(STORAGE_KEY, legacyPayload);
    expect(await adapter.getItem(STORAGE_KEY)).toBe(legacyPayload);

    const updatedPayload = JSON.stringify({ access_token: 'Y'.repeat(2500) });
    await adapter.setItem(STORAGE_KEY, updatedPayload);

    expect(store.has(STORAGE_KEY)).toBe(false);
    expect(await adapter.getItem(STORAGE_KEY)).toBe(updatedPayload);
  });

  it('recovers safely by wiping all chunks when missing chunk, bad manifest, corrupt JSON, or keystore error occurs', async () => {
    const corruptCases = [
      {
        name: 'missing middle chunk',
        corrupt: (store: Map<string, string>) => {
          store.delete(`${STORAGE_KEY}__chunk_1`);
        },
        expectedReason: 'missing_chunk',
      },
      {
        name: 'out-of-range chunk count in __meta',
        corrupt: (store: Map<string, string>) => {
          store.set(`${STORAGE_KEY}__meta`, JSON.stringify({ v: 1, count: 99, bytes: 4200 }));
        },
        expectedReason: 'invalid_manifest',
      },
      {
        name: 'malformed __meta JSON',
        corrupt: (store: Map<string, string>) => {
          store.set(`${STORAGE_KEY}__meta`, '{bad-json');
        },
        expectedReason: 'invalid_manifest',
      },
      {
        name: 'byte-length mismatch',
        corrupt: (store: Map<string, string>) => {
          const rawMeta = store.get(`${STORAGE_KEY}__meta`);
          const parsed = rawMeta ? (JSON.parse(rawMeta) as { sha256?: string }) : {};
          store.set(
            `${STORAGE_KEY}__meta`,
            JSON.stringify({
              v: 1,
              count: 3,
              bytes: 99999,
              sha256: parsed.sha256 ?? sha256Hex('x'),
            }),
          );
        },
        expectedReason: 'byte_length_mismatch',
      },
      {
        name: 'corrupted JSON session matching byte count & sha256',
        corrupt: (store: Map<string, string>) => {
          const broken = '{"access":"broken';
          store.set(`${STORAGE_KEY}__chunk_0`, broken);
          store.delete(`${STORAGE_KEY}__chunk_1`);
          store.delete(`${STORAGE_KEY}__chunk_2`);
          store.set(
            `${STORAGE_KEY}__meta`,
            JSON.stringify({
              v: 1,
              count: 1,
              bytes: utf8ByteLength(broken),
              sha256: sha256Hex(broken),
            }),
          );
        },
        expectedReason: 'corrupt_session_json',
      },
      {
        name: 'equal-length tampered chunk failing SHA-256 integrity digest',
        corrupt: (store: Map<string, string>) => {
          const c0 = store.get(`${STORAGE_KEY}__chunk_0`) ?? '';
          const replacementChar = c0.endsWith('Z') ? 'Y' : 'Z';
          store.set(`${STORAGE_KEY}__chunk_0`, `${c0.slice(0, -1)}${replacementChar}`);
        },
        expectedReason: 'digest_mismatch',
      },
    ];

    for (const testCase of corruptCases) {
      const { store, driver } = createSimulatedKeystore();
      const onCorruption = vi.fn();
      const adapter = createChunkedSecureStorage(driver, { onCorruption });

      await adapter.setItem(STORAGE_KEY, JSON.stringify({ token: 'Z'.repeat(3800) }));
      testCase.corrupt(store);

      const recovered = await adapter.getItem(STORAGE_KEY);
      expect(recovered, `Failed cleanup for ${testCase.name}`).toBeNull();
      expect(store.size, `Leftover entries after ${testCase.name}`).toBe(0);
      expect(onCorruption).toHaveBeenCalledWith({
        storageKey: STORAGE_KEY,
        reason: testCase.expectedReason,
      });
    }

    const { store, driver } = createSimulatedKeystore({
      throwOnReadKeys: [`${STORAGE_KEY}__meta`],
    });
    store.set(`${STORAGE_KEY}__chunk_0`, '{"token":"secret"}');
    const onKeystoreError = vi.fn();
    const throwingAdapter = createChunkedSecureStorage(driver, { onCorruption: onKeystoreError });

    expect(await throwingAdapter.getItem(STORAGE_KEY)).toBeNull();
    expect(store.size).toBe(0);
    expect(onKeystoreError).toHaveBeenCalledWith({
      storageKey: STORAGE_KEY,
      reason: 'keystore_read_error',
    });
  });

  it('prevents partial-write stale/mixed restoration, interrupted legacy migration, multibyte corruption, and concurrent write/delete races', async () => {
    let failChunk1Write = false;
    const partialWriteSim = createSimulatedKeystore({
      shouldFailWrite: (key) => failChunk1Write && key === `${STORAGE_KEY}__chunk_1`,
    });
    const partialAdapter = createChunkedSecureStorage(partialWriteSim.driver);
    const oldSession = JSON.stringify({ access_token: 'A'.repeat(3800) });
    const nextSession = JSON.stringify({ access_token: 'B'.repeat(3800) });

    await partialAdapter.setItem(STORAGE_KEY, oldSession);
    failChunk1Write = true;
    await expect(partialAdapter.setItem(STORAGE_KEY, nextSession)).rejects.toThrow(
      /Simulated partial write crash/,
    );
    expect(await partialAdapter.getItem(STORAGE_KEY)).toBeNull();
    expect(partialWriteSim.store.size).toBe(0);

    // Interrupted legacy migration: orphaned __chunk_0 alongside legacy key must fail closed
    const orphanSim = createSimulatedKeystore();
    const onOrphanCorrupt = vi.fn();
    const orphanAdapter = createChunkedSecureStorage(orphanSim.driver, {
      onCorruption: onOrphanCorrupt,
    });
    orphanSim.store.set(STORAGE_KEY, JSON.stringify({ access_token: 'stale_legacy' }));
    orphanSim.store.set(`${STORAGE_KEY}__chunk_0`, '{"access_token":"partial');
    expect(await orphanAdapter.getItem(STORAGE_KEY)).toBeNull();
    expect(orphanSim.store.size).toBe(0);
    expect(onOrphanCorrupt).toHaveBeenCalledWith({
      storageKey: STORAGE_KEY,
      reason: 'interrupted_write',
    });

    // Multi-byte 4-byte emoji + Arabic characters crossing 1800-byte boundary
    const multibytePayload = JSON.stringify({
      emoji: '🦈🔑'.repeat(600),
      label: 'مستثمر استراتيجي '.repeat(120),
    });
    const multibyteSim = createSimulatedKeystore();
    const multibyteAdapter = createChunkedSecureStorage(multibyteSim.driver);
    await multibyteAdapter.setItem(STORAGE_KEY, multibytePayload);
    expect(await multibyteAdapter.getItem(STORAGE_KEY)).toBe(multibytePayload);

    // Concurrent slow setItem + immediate removeItem must serialize safely to null
    const raceSim = createSimulatedKeystore({ setDelayMs: 5 });
    const raceAdapter = createChunkedSecureStorage(raceSim.driver);
    await Promise.all([
      raceAdapter.setItem(STORAGE_KEY, nextSession),
      raceAdapter.removeItem(STORAGE_KEY),
    ]);
    expect(await raceAdapter.getItem(STORAGE_KEY)).toBeNull();
    expect(raceSim.store.size).toBe(0);
  });
});
