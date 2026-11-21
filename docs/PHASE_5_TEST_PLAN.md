# Phase 5 Test Plan — Backend Integration & Application Services

> **Document Status:** Finalized Phase 5 Test Plan (Awaiting Project Manager Approval Before `M5.0`)
> **Master Plan:** [PHASE_5_PLAN.md](./PHASE_5_PLAN.md) | **Task Breakdown:** [PHASE_5_TASKS.md](./PHASE_5_TASKS.md) | **Security Baseline:** [SECURITY.md](./SECURITY.md)

---

## 1. Testing Strategy, Environment Separation & Safety Guardrails

Phase 5 tests verify every repository, Auth/Stale-Session guard, chunked `SecureStore` lifecycle, Storage upload/Signed URL flow, 13-domain Admin Server Actions/audit logging, error mapping, and RTL/i18n contract **without mocks masking RLS/security boundaries** and **without ever touching production databases**:

| Test Tier | Runtime | Target Environment | Purpose & Isolation Rule |
| :--- | :--- | :--- | :--- |
| **Tier 1: Unit, Hygiene & Contract Tests** | Vitest (`Node`) | Offline / In-memory | Chunked `SecureStore` round-trip & corruption recovery, error/cursor/env guards, production guard check, static zero-`.select('*')` & `service_role` bundle bans, `validation.*`/`errors.*` parity. |
| **Tier 2: Live Integration Tests** | Vitest (`Node`) | Ephemeral Local Docker Supabase (`127.0.0.1:54321`) or dedicated non-prod Staging | Live Auth signup/login/password reset, real repository CRUD across Investor/Founder/Company/Verification/Pitch/Document/Notification/Support, Realtime status & notifications, 13-domain Admin Server Actions + `activity_logs`. |
| **Tier 3: Negative Security & Stale-Session Tests** | Vitest + Next.js Action harness + Supabase | Ephemeral Local Docker Supabase | Stale-JWT revocation behavior for `pending`/`rejected`/`suspended`, Admin Triple-Gate (`middleware` + `guards` + CSRF Origin), Signed URL expiry/quarantine/revocation lockout, PostHog/Sentry PII scrubbing, client bundle secret scan. |
| **Tier 4: Build & GitHub Actions CI Gates** | CLI + Ubuntu Docker Runner | `.github/workflows/ci-quality.yml` & `.github/workflows/supabase-verify.yml` | Full `typecheck`, `lint`, `format:check`, `i18n:check`, `next build`, Android `expo export`, `deno check`, `supabase db reset`, `pgTAP`, and live Phase 5 integration tests. |

### Strict Environment Guard (`P5-ENV-GUARD`)
Before running any Tier 2 or Tier 3 integration suite, `tests/integration/setup-env.ts` enforces strict environment isolation:
1. **Default Target = Local Docker Supabase (`127.0.0.1:54321`):** Tests target local Docker containers (`APP_ENV=test` / `development`) by default using local CLI test keys.
2. **Staging Requires Explicit Opt-In:** Staging URLs are permitted **only** when BOTH `APP_ENV=staging` AND `ALLOW_STAGING_INTEGRATION_TESTS=true` are explicitly set alongside isolated non-production staging credentials.
3. **Unconditional Production Abort:** If `APP_ENV=production` (or `NEXT_PUBLIC_APP_ENV`/`EXPO_PUBLIC_APP_ENV === 'production'`), if `SUPABASE_URL` matches any configured production host/project ref, or if a remote URL is supplied without explicit staging opt-in, `setup-env.ts` **aborts immediately** with zero DB or Storage calls.

---

## 2. Tier 1 — Unit, Static Guard & Contract Test Cases

| Case ID | Target Module | Scenario & Assertions | Expected Result |
| :--- | :--- | :--- | :--- |
| **P5-U01** | `apps/mobile/src/services/secure-storage.ts` | 1) Persist, read, and delete a `4.5 KB` Supabase auth session across `1800`-byte chunks (`__meta` + `__chunk_0..N`).<br>2) Overwrite with smaller `600`-byte session.<br>3) Simulate missing `__chunk_1`, malformed JSON `__meta`, out-of-range `count: 99`, and Keystore throw. | Full round-trip equality; shrink removes obsolete trailing chunks cleanly; any corruption triggers total cleanup (`removeItem`), returns `null`, and never throws an unhandled boot error. |
| **P5-U02** | `apps/mobile/src/services/service-client.ts` & Admin helpers | Pass PostgreSQL codes (`42501`, `23505`, `23503`, `23514`, `PGRST116`) and Edge errors (`RATE_LIMITED`, `DOCUMENT_QUARANTINED`, `ACCOUNT_SUSPENDED`, `OWNERSHIP_TRANSFER_REQUIRED`) through `normalizeErrorToEnvelope` + i18n lookup. | Every `messageKey` exists in **both** `ar.json` and `en.json`; raw SQL messages and stack traces never propagate. |
| **P5-U03** | `tests/i18n/parity.test.ts` | Cross-check every string validation literal in `@shark/validation` and error key in `@shark/utils`/Edge Functions against `apps/mobile/src/i18n/{ar,en}.json` and `apps/admin/src/i18n/{ar,en}.json`. | `0` missing `validation.*` or `errors.*` keys in `ar` or `en`. |
| **P5-U04** | `tests/security/repo-hygiene.test.ts` | Static AST/regex audit across `apps/mobile/src/repositories/**`, `apps/admin/src/repositories/**`, `apps/admin/src/actions/**`. | Fails on any `.select('*')`, any Mobile reference to `internal_notes` or `admin.ts`, any `supabase.auth.getSession()` used for server authorization in `apps/admin`, or missing `import 'server-only'` in `admin.ts`/`env.server.ts`. |
| **P5-U05** | `apps/mobile/src/services/sentry.ts` & `analytics.ts` | Invoke `beforeSend` with `Authorization`, `apikey`, cookies, query `signedUrl=...`, and user emails; invoke `analytics.trackEvent` with `analytics_opt_in = false` vs `true`. | Sensitive headers, tokens, Signed URLs, and emails scrubbed; zero PostHog calls emitted while `analytics_opt_in === false`. |
| **P5-U06** | `apps/mobile/src/services/storage-upload.ts` | Pass `../evil.pdf`, `0`-byte payload, `>25 MiB` deck, `.svg` extension, and `image/svg+xml` MIME. | Rejected synchronously via `@shark/validation` before any Storage request. |
| **P5-U07** | `tests/integration/setup-env.test.ts` | Test `APP_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`, production ref with `ALLOW_STAGING_INTEGRATION_TESTS=true`, remote URL without staging opt-in, vs valid default `127.0.0.1:54321` and opted-in staging. | Production and unapproved remote targets **always** abort synchronously; default local Docker & explicit staging opt-in resolve cleanly. |

---

## 3. Tier 2 — Live Integration Scenarios (Mobile, Admin 13 Domains & Realtime)

Executed against local Docker Supabase (`0001`–`0008` + `seed_reference.sql` + `seed_dev_fixtures.sql`) using real SDK calls:

| Scenario ID | Flow Covered | Step-by-Step Verification | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **P5-I01** | **Mobile Signup, Onboarding & Verification Upload** | Register synthetic user -> confirm `handle_new_user()` sets `pending` + `member` -> select `investor` -> update profile (`profile-setup`) -> upload PDF to `verification-documents` + insert `verification_requests`. | Profile state persists cleanly across chunked `SecureStore` reload; `public_investors_directory` excludes pending user; `verification_requests` projection excludes `internal_notes`. |
| **P5-I02** | **Guest & Pending Discovery, Arabic Search & Cursor Paging** | Call `directory.repository` unauthenticated and as pending `@shark.test` user -> apply sector/stage/verified filters + normalized Arabic trigram query (`"مدار"` / `"مدآر"`) + paginate `cursor`. | Returns deterministic keyset pages with zero duplicate/skipped rows, zero PII (`email`, `phone`, `registration_number`), and zero pitch data. |
| **P5-I03** | **Founder Company, Member & Pitch Lifecycle** | Approved founder (`...1105`) creates `draft` company -> submits `pending` -> creates `draft` pitch -> uploads deck to `pitch-documents` (`uploadService` + `createPitchDocument`) -> submits `pending` -> closes approved round (`approved` -> `closed`). | Triggers sanitize admin-only metadata; closing sets `closed_at`; company operator permissions honored. |
| **P5-I04** | **Admin 13-Domain Authorization & Atomic Audit Rollback Verification** | Exercise server repositories & Server Actions across **all 13 Admin domains** (`PHASE_5_PLAN.md` §5.2) via atomic RPCs/Edge Functions, PLUS inject simulated `activity_logs` write failure inside transactional/Edge test. | Every mutating action & compliance preview records an accurate immutable `activity_logs` row; simulated audit failure rolls back the entity/user mutation cleanly and returns `500 AUDIT_PERSISTENCE_FAILED` (`errors.auditWriteFailed`) with **zero unaudited state change**. |
| **P5-I05** | **Signed URL Minting, TTL Cap & Pre-Expiry Refresh** | 1) Approved investor (`...1104`) calls `requestSignedDocumentUrl` for standard doc (`...4401`) and restricted doc (`...4402`).<br>2) Granted investor (`...1103`) calls for `...4402` and triggers pre-expiry refresh.<br>3) Compliance admin previews verification doc via Signed URL. | Standard returns `200` (`ttl <= 120s`, valid download URL); ungranted restricted returns `403`; granted restricted returns `200` (`ttl = 60s`) with `Cache-Control: no-store`, audit log row written, and refresh issues fresh valid URL. |
| **P5-I06** | **Notifications, Push Tokens, Interests & Bookmarks** | 1) Investor toggles bookmark (`saved_items`), submits & withdraws `investment_interests`.<br>2) Admin dispatches `send-push-notification` with `targetMode: 'role'` (`investor`).<br>3) Investor fetches paginated inbox, receives Realtime `INSERT`, marks read, upserts & deactivates `device_tokens` on logout. | Bounded recipient batches (`<= 500`) populate `notifications`; unread badge decrements cleanly; logout marks `device_tokens.is_active = false`. |
| **P5-I07** | **Self-Service Account Deletion (`delete-own-account`)** | 1) Wrong password -> `403`.<br>2) Multi-member company owner -> `409 OWNERSHIP_TRANSFER_REQUIRED`.<br>3) Solo user with valid password + `'DELETE'` -> `200`, cleans storage + tokens + auth user, anonymizes audit trail (`actor_id IS NULL`). | Account permanently deleted from `auth.users`; subsequent sign-in rejected; immutable `activity_logs` preserved. |

---

## 4. Tier 3 — Security, Stale-Session & Bundle Boundary Tests

| Security ID | Linked Control | Attack / Failure Simulation | Required System Behavior |
| :--- | :--- | :--- | :--- |
| **P5-S01** | `SEC-02` Signup Role Escalation | Client attempts `auth.signUp({ options: { data: { role: 'admin', account_status: 'approved' } } })` and `updateOwnProfileSchema.parse({ role: 'admin' })`. | Zod `.strict()` rejects payload; DB `handle_new_user()` forces `member` + `pending`. |
| **P5-S02** | `SEC-03` / `SEC-05` Stale JWT After Suspend / Reject | 1) User signs in and caches approved JWT + pitches in TanStack Query.<br>2) Admin suspends (`...` via `adminUserAction`) -> revokes global refresh token while local JWT is still `< 1h` old.<br>3) Simulated client uses that stale JWT to query `pitches`, call `get-signed-document-url`, and trigger foreground/Realtime sync in `AuthContext`. | Backend RLS returns `0` rows / `42501`; Edge Function returns `403 ACCOUNT_SUSPENDED`; Mobile `AuthContext` immediately runs `queryClient.clear()`, wipes chunked `SecureStore` session cleanly, and locks UI to `(auth)/suspended`. Same verified cleanly for `rejected` (feedback + appeal screen, pitch access zeroed). |
| **P5-S03** | `SEC-08` Mid-Session Revocation, Quarantine & Storage Isolation | 1) Granted investor holds an active viewer session (`useSignedDocumentUrl`) for `...4402`; Admin revokes grant or marks doc `scan_status = 'quarantined'`.<br>2) Viewer refresh triggers.<br>3) Client attempts direct public bucket URL `GET /storage/v1/object/public/pitch-documents/...`. | Refresh fails (`403 FORBIDDEN` / `403 DOCUMENT_QUARANTINED`); hook immediately clears `signedUrl` from memory and cancels timers; direct public Storage URL fails `400`/`404`. |
| **P5-S04** | `SEC-10` Admin Triple-Gate, Cross-Origin & Self-Action | 1) Approved non-admin (`investor`), suspended admin, revoked `admin_roles.is_active=false`, or out-of-scope `analyst_readonly` calls Admin Server Action.<br>2) Action called with mismatched `Origin: https://evil.example`.<br>3) Active `super_admin` invokes user/entity moderation targeting self. | Rejected server-side at `requireAdminContext` / `assertValidAdminOrigin` (`403 FORBIDDEN` / `/unauthorized`) **and** rejected independently inside DB RPC / Edge Functions (`403`/`42501`). |
| **P5-S05** | `SEC-11` Client Bundle Secret Inspection | Build `apps/admin` (`pnpm build:admin`) and export `apps/mobile` (`expo export --platform android`), scan `.next/static` & `.expo` JS/HBC outputs. | Zero occurrences of `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_ACCESS_TOKEN`, `INTERNAL_EDGE_SECRET`, or service JWTs. |

---

## 5. Continuous Integration Pipeline Execution (`ci-quality.yml` & `supabase-verify.yml`)

To guarantee zero skipped verification tests on GitHub Actions `ubuntu-latest`:
1. **`ci-quality.yml` (`push` / `pull_request` on `main`):**
   - `pnpm typecheck` -> `pnpm lint` -> `pnpm format:check` -> `pnpm test` (Tier 1 unit, contract, `SecureStore` chunking/recovery, static repo/projection hygiene, prod guard checks) -> `pnpm i18n:check` -> scoped secret scan (`apps/ packages/ supabase/ .env.example`) -> `pnpm build:admin` -> `pnpm --filter @shark/mobile exec expo export --platform android --output-dir .expo-verify-dist` (cleaned up) + bundle secret scan (`P5-S05`).
2. **`supabase-verify.yml` (`push` / `pull_request` / `workflow_dispatch` covering `supabase/**`, `apps/**`, `packages/**`, `tests/**`):**
   - `deno check` on `_shared/*.ts` + all 5 Edge Functions.
   - `supabase start` -> `supabase db reset` (0001–0008 migrations + both seeds) -> `psql` row count assertion -> `supabase test db` (all 9 pgTAP suites / `72` assertions).
   - Export ephemeral local env via `supabase status -o env` -> execute live Tier 2 & Tier 3 integration/security Vitest suites (`tests/integration/**` & security checks `P5-I01`–`P5-I07`, `P5-S01`–`P5-S05`) with `APP_ENV=test` against `http://127.0.0.1:54321`, stopping the stack via `trap 'supabase stop || true' EXIT` cleanly even on failure.

---

## 6. Mandatory Phase 5 Exit Checklist

- [ ] Every milestone `M5.0`–`M5.6` passes its defined acceptance criteria (`PHASE_5_PLAN.md` §7).
- [ ] All Tier 1–4 commands exit `0` after final edit with zero skipped tests (`typecheck`, `lint`, `format:check`, `i18n:check`, `pnpm test`, live integration/security suites, `next build`, Android `expo export`, and both GitHub Actions workflows green).
- [ ] Phase 6 Admin Dashboard module pages remain untouched (`apps/admin/src/app/(dashboard)/{overview..settings}` not started).
- [ ] Zero production credentials used and zero modifications to any production database.
