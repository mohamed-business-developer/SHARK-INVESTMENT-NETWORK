# Android Hermes & Dev Client Runtime Smoke Test Runbook

> **Status Note:** Offline Metro/Hermes compilation (`expo export --platform android` producing `.hbc` bytecode) verifies syntax and bundling only. It does **NOT** replace live runtime verification on an Android Emulator or physical Android device running Hermes.

---

## 1. Prerequisites & Safe Environment Setup

1. Ensure **non-production** environment variables only (`APP_ENV=development` against local Docker Supabase `http://10.0.2.2:54321` on Android Emulator / LAN IP on physical device, or explicit isolated non-prod staging credentials). **Never** use production Supabase credentials.
2. Verify Android SDK + `adb` are installed (`adb devices` shows an active emulator or USB device with USB debugging enabled).
3. Install a custom Android Dev Client matching `apps/mobile` native modules (`expo-secure-store`, `expo-notifications`, `expo-file-system`, `posthog-react-native`, `@sentry/react-native`):
   - **Local Android build:**
     ```bash
     cd apps/mobile
     pnpm exec expo prebuild --platform android
     pnpm android
     ```
   - **Or EAS internal development APK (`apps/mobile/eas.json` profile `development`):**
     ```bash
     cd apps/mobile
     pnpm exec eas build --profile development --platform android --local
     adb install <path-to-built.apk>
     pnpm exec expo start --dev-client
     ```
4. Stream live Hermes / React Native JS logs in a separate terminal:
   ```bash
   adb logcat -c
   adb logcat | grep -E "ReactNativeJS|Shark|Sentry|PostHog"
   ```

---

## 2. Live Runtime Verification Matrix

### Case A — Signed URL Lifecycle, Revocation & Lockout (`T5-14`)
1. **Mount & Auto-Refresh:** Sign in as an approved investor fixture (`...1103`) and mount a viewer using `useSignedDocumentUrl` against an approved confidential document (`...4402`, 60s TTL). Confirm PDF/preview loads cleanly and logcat shows a proactive refresh request at `~50s` with no viewer flicker or error state.
2. **Background / Focus Pause & Expiry Wipe:** Press Android Home (AppState `background`) and wait `> 65s`. Verify in proxy/Supabase Edge logs that zero refresh requests fired while backgrounded, memory state dropped to `null` at `expiresAt`, and returning to foreground immediately requests a fresh URL.
3. **Quarantine / Revocation / 429 Immediate Wipe:** Trigger `403 DOCUMENT_QUARANTINED`, `403 FORBIDDEN`, or `429 RATE_LIMITED` (revoke access grant, mark `scan_status = 'quarantined'`, or exceed Edge Function limit) while a document is open. Verify:
   - Viewer immediately clears content and enters locked state (`isLocked = true`).
   - Subsequent timer waits (`> 120s`) emit zero further requests.
4. **Zero Disk Persistence Audit:** Dump the app sandbox via `adb shell run-as com.sharknetwork.app ls -R files/ cache/` and inspect SharedPreferences/AsyncStorage/SecureStore entries; verify zero occurrences of `token=` or `storage/v1/object/sign` exist on disk.

### Case B — Sentry PII Redaction & Analytics Opt-In / Reset (`T5-16`)
1. Confirm an account with `analytics_opt_in = false` emits zero outbound PostHog network calls (`eu.i.posthog.com`) across login, screen navigation, and sign-out.
2. Confirm a deliberate scrubbed breadcrumb/error containing an email, phone (`+966 50 123 4567`, `050 123 4567`), Bearer JWT, or Signed URL query string arrives redacted in non-prod Sentry.
3. Trigger `signOut()` under offline/throttled network; confirm UI sign-out transition completes within `< 500 ms` without hanging on analytics teardown.

### Case C — Push Tokens, Account Switching & Notifications (`T5-15`)
1. Register push notifications on Account A; confirm `device_tokens` row (`is_active = true`) is created for Account A.
2. Perform `signOut()` on Account A -> verify Account A's token flips to `is_active = false` cleanly before session clear.
3. Simulate a stale token conflict on Account B (leave Account A's `ExpoPushToken[...]` active in DB, then sign in on Account B on the same device); confirm Account B login/inbox works normally with a non-fatal `token_conflict_degraded` push state and never reveals Account A metadata.
4. Insert a new `notifications` row for the active account in local/staging Supabase; confirm live Realtime inbox append, unread badge increment, mark-read decrement, and safe relative deep-link navigation.

### Case D — Chunked Streaming SHA-256 Probe (`T5-13 Spike Verification on Device`)
1. Execute the Hermes streaming SHA-256 spike against synthetic `1 MiB`, `10 MiB`, and `25 MiB` temp files created inside `Paths.cache` via `File.open()` (`FileHandle.readBytes(chunkSize)`).
2. Compare emitted 64-char hex digest against `sha256sum` / Node.js `crypto.createHash('sha256')` on the identical test file and record elapsed milliseconds + Android Studio Profiler JS Heap / Native heap delta (verifying zero `25 MiB` single-buffer spike).
