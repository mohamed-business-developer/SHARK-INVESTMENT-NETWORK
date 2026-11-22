# T5-13 Technical Spike — Bounded-Memory SHA-256 Streaming Verification

> **Status:** Technical Spike Completed (Implementation of `apps/mobile/src/services/storage-upload.ts` and live Storage HTTP uploads intentionally deferred until separate PM authorization).
> **Spike Code:** [`apps/mobile/src/services/sha256-stream.ts`](../apps/mobile/src/services/sha256-stream.ts)
> **Spike Tests:** [`tests/services/sha256-streaming-spike.test.ts`](../tests/services/sha256-streaming-spike.test.ts)

---

## 1. Objective

Evaluate a zero-native-dependency incremental SHA-256 streaming implementation compatible with Expo SDK 54 (`expo-file-system` ~`19.0.24`) and Hermes bytecode compilation for files up to the `MAX_PITCH_DOCUMENT_BYTES` ceiling (`25 MiB` = `26,214,400` bytes), verifying:
1. Exact cryptographic digest parity with Node.js `crypto.createHash('sha256')`.
2. Memory ceiling (`heapUsed`, `arrayBuffers`, `rss`) across chunk sizes (`64 KiB`–`1024 KiB`).
3. Native Expo/Android/iOS limitations and Hermes bytecode compilation compatibility.

---

## 2. Benchmark & Digest Parity Results (Node v22.x `--expose-gc`, Measured Real Disk Files)

### A. Digest Parity & Size/Chunk Matrix (`new Uint8Array(chunk)` per `readBytes` simulating `FileHandle.readBytes`)

| File Size | Chunk Size | Chunks | Digest Parity vs Node `crypto.createHash('sha256')` | Node OpenSSL Time | Stream TS Time | Throughput | Peak `heapUsed` Delta | Peak `arrayBuffers` Delta | Peak `rss` Delta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1 MiB` | `256 KiB` | `4` | Exact match | `7.8 ms` | `26.3 ms` | `38.00 MB/s` | `+0.08 MiB` | `+1.25 MiB` | `+2.23 MiB` |
| `5 MiB` | `256 KiB` | `20` | Exact match | `21.4 ms` | `108.6 ms` | `46.04 MB/s` | `+0.04 MiB` | `+5.25 MiB` | `+5.25 MiB` |
| `10 MiB` | `256 KiB` | `40` | Exact match | `25.1 ms` | `190.7 ms` | `52.44 MB/s` | `+0.51 MiB` | `+10.25 MiB` | `+10.27 MiB` |
| `25 MiB` | `64 KiB` | `400` | Exact match | `60.6 ms` | `466.3 ms` | `53.61 MB/s` | `+0.67 MiB` | `+25.06 MiB` | `+25.06 MiB` |
| `25 MiB` | `256 KiB` | `100` | Exact match | `97.2 ms` | `480.5 ms` | `52.03 MB/s` | `+0.47 MiB` | `+25.25 MiB` | `+24.79 MiB` |
| `25 MiB` | `512 KiB` | `50` | Exact match | `70.5 ms` | `436.1 ms` | `57.33 MB/s` | `+0.54 MiB` | `+25.50 MiB` | `+25.70 MiB` |
| `25 MiB` | `1024 KiB` | `25` | Exact match | `109.2 ms` | `391.8 ms` | `63.81 MB/s` | `+0.17 MiB` | `+26.00 MiB` | `+26.14 MiB` |

### B. Reusable Single-Buffer Control (`25 MiB` File, One Reused `256 KiB` Buffer)

| Mode | Stream TS Time | Peak `heapUsed` Delta | Peak `arrayBuffers` Delta | Peak `rss` Delta |
| :--- | :--- | :--- | :--- | :--- |
| Reusable `256 KiB` `Uint8Array` | `374.2 ms` | `+0.609 MiB` | `+0.250 MiB` | `+5.020 MiB` |

**Key Memory Finding:** `createIncrementalSha256()` retains strictly constant working state (`Int32Array(8)`, `Int32Array(64)`, `Uint8Array(64)` ≈ `~352 bytes`), keeping `heapUsed` growth below `0.7 MiB` across all runs. However, when a reader allocates a fresh `Uint8Array(chunk)` on every synchronous call without GC collection between chunks (as `FileHandle.readBytes(len)` does), uncollected native `ArrayBuffer` backing stores can accumulate up to the file size (`~25 MiB`) before major/external GC triggers. Therefore, chunked reading on Expo should use `256 KiB` chunks paired with periodic event-loop yields (`setTimeout(resolve, 0)` every few chunks on large files if needed) so Hermes's concurrent Hades GC reclaims expired chunk buffers promptly.

---

## 3. Hermes Compilation & Runtime Honesty Boundary

- **Hermes Compiler (`hermesc.exe` from `react-native@0.81.5`):** Compiled cleanly (`tsc --target es2020` output `6,830 bytes` → `5,968 bytes` `.hbc` bytecode, exit code `0`). Full Android `expo export` also compiles clean `.hbc`.
- **Android Device Runtime Status:** **Not yet executed on Android hardware/emulator** (`NO_ADB` / no standalone `hermes.exe` VM on Windows build host). Because Hermes interprets `.hbc` without a JIT compiler, a `25 MiB` pure-JS hash is expected to take longer on mobile ARM64 CPUs than Node v22 V8 (`~480 ms`); verify exact device latency via [`docs/ANDROID_HERMES_SMOKE_TEST.md`](./ANDROID_HERMES_SMOKE_TEST.md) Case D.

---

## 4. Documented Native Expo / Platform Limitations

Inspection of the installed `expo-file-system@19.0.24` native implementations reveals four concrete constraints that `T5-13` implementation must handle when authorized:

1. **No Native Streaming SHA-256 in `expo-file-system` or `expo-crypto`:**
   - `FileSystemFile.kt` and `FileSystemFile.swift` compute `md5` only (and `FileSystemFile.swift` loads the entire file via `Data(contentsOf: url)`).
   - `expo-crypto` (not installed in `apps/mobile/package.json`) provides one-shot `digest(CryptoDigestAlgorithm.SHA256, data)` without incremental chunk updates, which would require buffering an entire `25 MiB` payload in memory at once.
2. **No `readInto(existingBuffer)` on `FileHandle`:**
   - Both [`FileSystemFileHandle.kt`](../apps/mobile/node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/FileSystemFileHandle.kt) (`ByteBuffer.allocate(...)`) and [`FileSystemFileHandle.swift`](../apps/mobile/node_modules/expo-file-system/ios/FileSystemFileHandle.swift) (`handle.read(upToCount:)`) allocate a fresh native byte array per `readBytes(length)` call and bridge a new `Uint8Array` to JS. `256 KiB` (`DEFAULT_SHA256_CHUNK_SIZE_BYTES`) balances bridge call overhead (`100` calls for `25 MiB`) against per-chunk memory footprint (`0.25 MiB`).
3. **Android `"rw"` File Channel Opening Limitation (`content://` & Read-Only Files):**
   - `FileSystemFileHandle.kt` opens `RandomAccessFile(file.javaFile, "rw").channel` (`FileSystemFileHandle.swift` similarly uses `FileHandle(forUpdating:)`). Android SAF `content://` URIs or read-only asset paths must first be copied into an app-writable cache file (`Paths.cache`) via `File.copy(...)` and deleted in `finally` before calling `.open()` / `readBytes(...)`.
4. **Supabase React Native Storage Upload Payload Format:**
   - Standard JS `supabase.storage.from(bucket).upload(...)` with React Native `FormData` (`{ uri, name, type }`) or `ArrayBuffer` avoids doubling JS heap during upload, whereas converting a `25 MiB` file to Base64 or calling `file.bytes()` after hashing would cause an avoidable `25–34 MiB` memory spike.

---

## 5. Recommendation for Future T5-13 Implementation

1. Keep `DEFAULT_SHA256_CHUNK_SIZE_BYTES = 262_144` (`256 KiB`), normalizing picked URIs through temporary `Paths.cache` cleanup in `finally` when needed.
2. Pair `createIncrementalSha256()` / `hashChunkedReaderSha256()` with brief macrotask yields (`every N chunks`) during `> 5 MiB` files to let Hermes Hades GC collect transient `FileHandle.readBytes` buffers.
3. Validate `T5-13` device runtime speed on Android Dev Client (`ANDROID_HERMES_SMOKE_TEST.md` Case D); if real ARM64 Hermes latency exceeds UX targets (`> 2.5s` for `25 MiB`), evaluate adding a lightweight native Expo streaming SHA-256 function behind the same `hashFileSha256` interface.
