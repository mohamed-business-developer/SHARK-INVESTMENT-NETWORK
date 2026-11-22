/**
 * T5-13 Technical Spike: Pure-TypeScript bounded-memory incremental SHA-256 hasher.
 * Designed for Hermes/Expo JS runtimes (e.g., paired with `File.open().readBytes(chunkSize)`).
 * Zero `Buffer`, zero `BigInt`, and zero dynamic allocations inside block compression.
 */

export const DEFAULT_SHA256_CHUNK_SIZE_BYTES = 256 * 1024; // 256 KiB
export const MIN_SHA256_CHUNK_SIZE_BYTES = 16 * 1024; // 16 KiB
export const MAX_SHA256_CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB

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

const SHA256_IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

export interface StreamingSha256Hasher {
  readonly update: (chunk: Uint8Array) => void;
  readonly digestHex: () => string;
  readonly getTotalBytes: () => number;
}

export interface ChunkedByteReader {
  readonly readBytes: (length: number) => Uint8Array | Promise<Uint8Array>;
}

export interface StreamingSha256Result {
  readonly digestHex: string;
  readonly totalBytes: number;
  readonly chunkCount: number;
  readonly chunkSizeBytes: number;
}

export function createIncrementalSha256(): StreamingSha256Hasher {
  const h = new Int32Array(SHA256_IV);
  const w = new Int32Array(64);
  const block = new Uint8Array(64);
  let blockLen = 0;
  let totalBytes = 0;
  let finalizedHex: string | null = null;

  const compress = (src: Uint8Array, offset: number): void => {
    for (let i = 0; i < 16; i += 1) {
      const idx = offset + i * 4;
      w[i] = (src[idx]! << 24) | (src[idx + 1]! << 16) | (src[idx + 2]! << 8) | src[idx + 3]! | 0;
    }

    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }

    let a = h[0]!;
    let b = h[1]!;
    let c = h[2]!;
    let d = h[3]!;
    let e = h[4]!;
    let f = h[5]!;
    let g = h[6]!;
    let hh = h[7]!;

    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i]! + w[i]!) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + b) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + hh) | 0;
  };

  return {
    update(chunk: Uint8Array): void {
      if (finalizedHex !== null) {
        throw new Error('Cannot update SHA-256 hasher after digestHex() has been called.');
      }
      const len = chunk.length;
      if (len === 0) {
        return;
      }

      totalBytes += len;
      let offset = 0;

      if (blockLen > 0) {
        const needed = 64 - blockLen;
        if (len < needed) {
          block.set(chunk, blockLen);
          blockLen += len;
          return;
        }
        block.set(chunk.subarray(0, needed), blockLen);
        compress(block, 0);
        blockLen = 0;
        offset = needed;
      }

      while (offset + 64 <= len) {
        compress(chunk, offset);
        offset += 64;
      }

      if (offset < len) {
        const remainder = chunk.subarray(offset);
        block.set(remainder, 0);
        blockLen = remainder.length;
      }
    },

    digestHex(): string {
      if (finalizedHex !== null) {
        return finalizedHex;
      }

      const bitLenHi = Math.floor(totalBytes / 0x20000000);
      const bitLenLo = (totalBytes << 3) >>> 0;

      block[blockLen++] = 0x80;
      if (blockLen > 56) {
        block.fill(0, blockLen, 64);
        compress(block, 0);
        blockLen = 0;
      }

      block.fill(0, blockLen, 56);
      block[56] = (bitLenHi >>> 24) & 0xff;
      block[57] = (bitLenHi >>> 16) & 0xff;
      block[58] = (bitLenHi >>> 8) & 0xff;
      block[59] = bitLenHi & 0xff;
      block[60] = (bitLenLo >>> 24) & 0xff;
      block[61] = (bitLenLo >>> 16) & 0xff;
      block[62] = (bitLenLo >>> 8) & 0xff;
      block[63] = bitLenLo & 0xff;
      compress(block, 0);

      let out = '';
      for (let i = 0; i < 8; i += 1) {
        out += (h[i]! >>> 0).toString(16).padStart(8, '0');
      }
      finalizedHex = out;
      return out;
    },

    getTotalBytes: () => totalBytes,
  };
}

export async function hashChunkedReaderSha256(
  reader: ChunkedByteReader,
  options?: {
    readonly chunkSizeBytes?: number;
    readonly yieldEveryChunks?: number;
  },
): Promise<StreamingSha256Result> {
  const requestedChunk = options?.chunkSizeBytes ?? DEFAULT_SHA256_CHUNK_SIZE_BYTES;
  const chunkSizeBytes = Math.max(
    MIN_SHA256_CHUNK_SIZE_BYTES,
    Math.min(MAX_SHA256_CHUNK_SIZE_BYTES, Math.trunc(requestedChunk)),
  );
  const yieldEveryChunks = Math.max(1, options?.yieldEveryChunks ?? 16);

  const hasher = createIncrementalSha256();
  let chunkCount = 0;

  while (true) {
    const chunk = await reader.readBytes(chunkSizeBytes);
    if (chunk.byteLength === 0) {
      break;
    }
    hasher.update(chunk);
    chunkCount += 1;

    if (chunkCount % yieldEveryChunks === 0) {
      await Promise.resolve();
    }
  }

  return {
    digestHex: hasher.digestHex(),
    totalBytes: hasher.getTotalBytes(),
    chunkCount,
    chunkSizeBytes,
  };
}
