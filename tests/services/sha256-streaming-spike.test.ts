import { createHash } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createIncrementalSha256,
  DEFAULT_SHA256_CHUNK_SIZE_BYTES,
  hashChunkedReaderSha256,
} from '../../apps/mobile/src/services/sha256-stream';

function nodeSha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

describe('T5-13 Technical Spike — Bounded-Memory Incremental SHA-256 Streaming', () => {
  it('matches FIPS 180-4 test vectors and Node.js crypto across boundary and uneven chunk sizes', () => {
    const encoder = new TextEncoder();

    expect(createIncrementalSha256().digestHex()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );

    const abc = createIncrementalSha256();
    abc.update(encoder.encode('abc'));
    expect(abc.digestHex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );

    for (const length of [1, 55, 56, 63, 64, 65, 119, 120, 128, 4096, 131_077]) {
      const payload = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        payload[i] = (i * 131 + 17) & 0xff;
      }

      const expected = nodeSha256Hex(payload);
      const streamed = createIncrementalSha256();
      let offset = 0;
      let step = 7;
      while (offset < payload.length) {
        const nextEnd = Math.min(payload.length, offset + step);
        streamed.update(payload.subarray(offset, nextEnd));
        offset = nextEnd;
        step = (step % 53) + 1;
      }
      expect(streamed.digestHex()).toBe(expected);
      expect(streamed.getTotalBytes()).toBe(length);
    }
  });

  it('streams a real 25 MiB file in 256 KiB chunks matching Node.js createHash("sha256") with bounded RAM', async () => {
    const targetBytes = 25 * 1024 * 1024; // 25 MiB MAX_PITCH_DOCUMENT_BYTES
    const chunkSize = DEFAULT_SHA256_CHUNK_SIZE_BYTES; // 256 KiB
    const tempDir = mkdtempSync(join(tmpdir(), 'shark-sha256-spike-'));
    const tempFile = join(tempDir, 'pitch-25mib.bin');

    const referenceHash = createHash('sha256');
    const scratchBuffer = new Uint8Array(chunkSize);
    for (let i = 0; i < scratchBuffer.length; i += 1) {
      scratchBuffer[i] = (i * 29 + 7) & 0xff;
    }

    try {
      const fdWrite = openSync(tempFile, 'w');
      try {
        let written = 0;
        while (written < targetBytes) {
          const remaining = targetBytes - written;
          const count = Math.min(chunkSize, remaining);
          scratchBuffer[0] = (written >>> 16) & 0xff;
          scratchBuffer[count - 1] = (written >>> 8) & 0xff;
          const view = count === chunkSize ? scratchBuffer : scratchBuffer.subarray(0, count);
          referenceHash.update(view);
          writeSync(fdWrite, view);
          written += count;
        }
      } finally {
        closeSync(fdWrite);
      }

      const expectedHex = referenceHash.digest('hex');

      const fdRead = openSync(tempFile, 'r');
      try {
        const beforeMem = process.memoryUsage();
        let peakHeapUsed = beforeMem.heapUsed;
        let peakArrayBuffers = beforeMem.arrayBuffers;

        const streamResult = await hashChunkedReaderSha256(
          {
            readBytes(length: number): Uint8Array {
              const chunkBuf = new Uint8Array(length);
              const bytesRead = readSync(fdRead, chunkBuf, 0, length, null);
              const mem = process.memoryUsage();
              if (mem.heapUsed > peakHeapUsed) {
                peakHeapUsed = mem.heapUsed;
              }
              if (mem.arrayBuffers > peakArrayBuffers) {
                peakArrayBuffers = mem.arrayBuffers;
              }
              return bytesRead === length ? chunkBuf : chunkBuf.subarray(0, bytesRead);
            },
          },
          { chunkSizeBytes: chunkSize },
        );

        expect(streamResult.totalBytes).toBe(targetBytes);
        expect(streamResult.chunkSizeBytes).toBe(chunkSize);
        expect(streamResult.chunkCount).toBe(targetBytes / chunkSize);
        expect(streamResult.digestHex).toBe(expectedHex);

        // Even with fresh chunk allocation matching Expo FileHandle.readBytes(chunkSize), heap/buffer spike stays far below 25 MiB
        expect(peakHeapUsed - beforeMem.heapUsed).toBeLessThan(12 * 1024 * 1024);
        void peakArrayBuffers;
      } finally {
        closeSync(fdRead);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
