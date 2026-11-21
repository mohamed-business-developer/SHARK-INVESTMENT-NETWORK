# Phase 5 Implementation Plan — Backend Integration & Application Services

> **Document Status:** Finalized Phase 5 Plan (`M5.0` Authorized; `M5.1`+ Awaiting Project Manager Approval)
> **Project:** SHARK Investment Network (`C:\DEV\shark-investment-network`)
> **Verified Prerequisite Baseline:** Phase 4 approved via GitHub Actions `Supabase Verification` ([Run #44904374849](https://github.com/mohamed-business-developer/SHARK-INVESTMENT-NETWORK/actions/runs/44904374849)) and `CI Quality & Secret Hygiene` ([Run #44904973633](https://github.com/mohamed-business-developer/SHARK-INVESTMENT-NETWORK/actions/runs/44904973633))
> **Governing References:** [AGENTS.md](../AGENTS.md) | [PRD.md](./PRD.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [DATABASE.md](./DATABASE.md) | [SECURITY.md](./SECURITY.md) | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) | [ROADMAP.md](./ROADMAP.md)

---

## 1. Executive Objective & Scope Boundaries

Phase 5 wires **SHARK Investment Network's** approved Supabase backend (`supabase/migrations/0001..0008`, 5 Edge Functions, RLS views/RPCs, private Storage buckets) and shared workspace packages (`@shark/shared-types`, `@shark/validation`, `@shark/utils`, `@shark/design-tokens`) into clean, testable application service layers across both clients:

1. **Mobile Application (`apps/mobile`):** Encrypted chunked session persistence (`SecureStore`), live `AuthContext` + stale-session/suspension enforcement, typed repositories (explicit column projections, keyset pagination, Zod `.strict()` boundary validation), TanStack Query hooks, safe Storage uploads, short-lived Signed URL lifecycle management, Realtime notifications, Expo Push registration, privacy-configured PostHog telemetry, Sentry header/PII scrubbing, and Expo Router screen composition + integration built on Phase 3 UI primitives.
2. **Admin Dashboard Foundations (`apps/admin`):** `@supabase/ssr` browser/server/admin client isolation, `middleware.ts` session refresh & protection, server-side **Triple-Gate** `requireAdminContext(requiredScope?)` guards, origin/CSRF validation (`ADMIN_ALLOWED_ORIGINS`), typed `server-only` repositories & audited Server Actions across all 13 governance domains, plus Admin `/login` and `/unauthorized` authentication pages.

### Clarified Screen Implementation vs. Service Integration Boundary
Inspection of the current repository confirms what exists today versus what Phase 5 adds:
- **`apps/mobile` (`apps/mobile/app/` & `apps/mobile/src/components/`):** Phase 3 implemented the complete Design System primitives (`src/components/ui/*`), domain cards (`InvestorCard`, `CompanyCard`, `PitchCard`), and navigation shells (`BottomTabBarShell`, `ScreenHeader`, `AccessGateModal`). Inside `apps/mobile/app/`, **only** `_layout.tsx` and `index.tsx` currently exist (no business route screens exist yet). Therefore:
  - **Milestones `M5.0`–`M5.5`** deliver purely backend integration, contracts, state/query hooks, repositories, storage/push/telemetry services, and Admin server actions/guards (**zero business screen UI**).
  - **Milestone `M5.6` (`T5-20`, `T5-21`)** explicitly **both** creates the Expo Router route files (`(auth)/*` 11 routes, `(tabs)/*` 5-tab routes, `investors/[id]`, `companies/[id]`, `pitches/[id]`, `pitches/[id]/viewer`, `search`, `sectors/[slug]`, and 10 `account/*` routes) by composing the existing Phase 3 UI primitives (`src/components/ui/*`, `cards/*`, `navigation/*` — introducing no new Phase 3 token/primitive redesign) **AND** wires them to live Phase 5 hooks/repositories. *(Should the Project Manager choose an incremental sign-off gate, `M5.0`–`M5.5` are strictly decoupled and independently verifiable before `M5.6` route assembly begins.)*
- **`apps/admin` (`apps/admin/src/app/`):** Phase 5 creates ONLY `(auth)/login`, `(auth)/unauthorized`, `(dashboard)/layout.tsx` auth gate, `middleware.ts`, `lib/*`, `repositories/*`, and `actions/*`. **All 13 Admin Dashboard module UI pages (`(dashboard)/overview` through `/settings`) remain strictly deferred to Phase 6.**

### Non-Negotiable Constraints
- **Supabase Remains Sole Backend:** Zero Firebase dependencies or non-Supabase BaaS services.
- **Zero RLS Bypass & Zero Client Secrets:** All mobile queries and browser admin queries use the public anon key under PostgreSQL `FORCE ROW LEVEL SECURITY`. `SUPABASE_SERVICE_ROLE_KEY` is restricted exclusively to `import 'server-only'` Next.js Server modules (strictly gated by `requireAdminContext`) and Deno Edge Functions.
- **No Confidential Document Leaks:** `pitch-documents` and `verification-documents` are served exclusively via short-lived Signed URLs (`60s`–`120s` TTL) issued by `get-signed-document-url` and are never exposed via public buckets or persisted to long-lived cache.
- **No Production DB Modifications:** All Phase 5 development and CI tests run solely against isolated local Docker Supabase or an isolated staging environment.

---

## 2. Codebase & Contract Inspection Findings (Pre-Phase 5 Alignment)

Inspection of Phase 1–4 artifacts identified five concrete technical items resolved in Milestone `M5.0` prior to service wiring:

| ID | Finding | Impact | Phase 5 Resolution |
| :--- | :--- | :--- | :--- |
| **G5-01** | `SendPushNotificationRequest` (`packages/shared-types/src/notifications.ts`) & `sendPushNotificationSchema` (`packages/validation/src/admin.schema.ts`) use `{ targetMode, userIds, role, sectorId }`, while `supabase/functions/send-push-notification/index.ts` expects `{ recipientIds }`. | Admin notification dispatch would fail schema validation (`400`) if called directly with `targetMode`. | Resolve `targetMode` (`user_ids`, `role`, `sector`, `all_approved`) inside Admin's server-only notifications service into bounded `recipientIds` batches (`<= 500` UUIDs) before invoking `send-push-notification` (or support both cleanly). |
| **G5-02** | `apps/mobile/src/i18n/{ar,en}.json` and `apps/admin/src/i18n/{ar,en}.json` lack `validation.*` keys emitted by `@shark/validation` and `errors.*` keys returned by `normalizeErrorToEnvelope` (`@shark/utils`) and Edge Functions. | Form validation and Edge Function errors would show raw translation keys instead of Arabic/English copy. | Populate complete `validation.*` & `errors.*` dictionaries in both apps (`T5-02`) and enforce automated parity + schema key verification (`P5-U03`). |
| **G5-03** | `expo-secure-store` enforces a `2048`-byte single-item cap on iOS/Android, whereas Supabase v2 session JSONs exceed `2.5 KB`. | Large JWT sessions could silently fail persistence or truncate on mobile devices. | Implement a deterministic chunked `SecureStore` adapter (`apps/mobile/src/services/secure-storage.ts`) with `1800`-byte chunks, manifest metadata, corruption recovery, and atomic cleanup (`T5-04`). |
| **G5-04** | Migration `0007` revoked table-level `SELECT` on `verification_requests` for `authenticated` and granted column-level `SELECT` excluding `internal_notes`. | Any client `.select('*')` or query referencing `internal_notes` fails with PostgreSQL `42501 permission denied`. | Enforce static `SELECT_COLUMNS` constants omitting `internal_notes` across all Mobile repositories; restrict `internal_notes` reads strictly to Admin server-only repositories with `verifications:read`. |
| **G5-05** | `apps/mobile/src/services/env.ts` and `apps/admin/src/lib/env.ts` permit empty URLs/keys for offline Phase 2/3 builds, and `apps/admin` lacks `env.server.ts`. | Live service calls require fail-closed env verification without breaking offline CI `next build`. | Add lazy runtime env validation helpers (`assertMobileSupabaseEnv`, `assertAdminPublicEnv`, `getAdminServerEnv` with `import 'server-only'`) enforced on client creation & server entrypoints (`T5-03`). |

---

## 3. Clean Architecture, Layering & Server-Side Authorization

```text
apps/mobile
 ├── app/**                    (Routes & UI only; zero direct Supabase imports)
 ├── src/hooks/**              (TanStack Query, AuthContext, React Hook Form + Zod)
 ├── src/repositories/**       (Sole Supabase SDK boundary; explicit projections + cursors)
 └── src/services/**           (Supabase client, chunked SecureStore, Storage, Signed URLs, Push, Sentry, PostHog)

apps/admin
 ├── middleware.ts             (@supabase/ssr cookie refresh via getUser() + route pre-gate)
 ├── src/app/(auth)/**         (/login, /unauthorized)
 ├── src/actions/**            (Server Actions: Origin/CSRF check + requireAdminContext + audit)
 ├── src/repositories/**       (server-only Admin DB & Edge Function callers)
 └── src/lib/**                (supabase/{client,server,admin}.ts, auth/guards.ts, env.server.ts)
```

### Mandatory Server-Side Authorization on Every Protected Request
No client check or JWT `user_metadata` claim is ever treated as authoritative:
1. **Mobile PostgREST & Storage Calls:** Every query passes the user's JWT over HTTPS (`SUPABASE_ANON_KEY`). PostgreSQL `FORCE ROW LEVEL SECURITY` evaluates live `auth.uid()`, `public.is_approved_user()`, `public.is_not_suspended()`, `public.is_company_operator()`, `public.can_view_pitch()`, and `public.can_view_pitch_document()` against `public.profiles` on every row. `BEFORE INSERT/UPDATE/DELETE` triggers enforce immutable privilege columns and state transitions.
2. **Edge Function Calls:** Every Edge Function (`get-signed-document-url`, `admin-user-action`, `admin-review-entity`, `send-push-notification`, `delete-own-account`) validates caller JWT live via `authClient.auth.getUser(jwt)`, inspects live `profiles` (`deleted_at IS NULL`, `account_status != 'suspended'`), checks `admin_roles` scope where applicable, enforces Zod `.strict()` schemas, and applies sliding-window DB rate limiting (`check_rate_limit`).
3. **Admin Web Dashboard Requests & Server Actions (`apps/admin`):**
   - **Gate 1 (`middleware.ts`):** Refreshes `@supabase/ssr` cookies via `supabase.auth.getUser()` (never `getSession()` alone) and redirects unauthenticated visitors away from protected dashboard paths to `/login`.
   - **Gate 2 (`(dashboard)/layout.tsx` & `requireAdminContext(requiredScope?)`):** Runs exclusively on the server (`import 'server-only'`), re-verifies the user via `supabase.auth.getUser()`, queries live `profiles` (`role === 'admin' && account_status === 'approved' && deleted_at IS NULL`) and live `admin_roles` (`is_active === true && deleted_at IS NULL`), verifies `role_name === 'super_admin' || permissions.includes(requiredScope)` (plus MFA `aal2` when enrolled), otherwise redirecting to `/unauthorized` or throwing `AppDomainError(403, 'FORBIDDEN', 'errors.forbidden')`.
   - **Gate 3 (`assertValidAdminOrigin`):** Every mutating Server Action and Route Handler validates the HTTP `Origin` / `Referer` header against `ADMIN_ALLOWED_ORIGINS` (`adminServerEnvSchema`) and re-validates inputs using `@shark/validation` `.strict()` schemas before invoking Edge Functions or audited server operations.

---

## 4. Authentication, Stale Sessions & Encrypted Storage Handling

### 4.1 Mobile Auth & Onboarding Flow (`AuthContext`)
1. **Guest Mode (`session === null`):** Opens on `welcome` or Guest public discovery (`(tabs)/discovery`, `investors`, `companies`, `sectors/[slug]`, public `search`). Fetches ONLY `public_investors_directory`, `public_companies_directory`, `public_portfolio_companies_directory`, `sectors`, and `get_public_system_flags()`. Pitch, bookmark, and account mutation queries remain disabled; UI taps trigger `AccessGateModal`.
2. **Signup & Onboarding:** `auth.signUp()` -> PostgreSQL trigger `handle_new_user()` forces `account_status = 'pending'` and downgrades any spoofed `admin` metadata -> `account-type` (`SIGNUP_SELECTABLE_ROLES`: `investor | founder | member` only) -> `profile-setup` -> optional `verification` (`verification-documents` upload to `{user_id}/{req_id}/{doc_id}.{ext}`) -> `pending-approval`.
3. **Password Reset & Account Deletion:** `forgot-password` / `reset-password` (`shark://auth/callback`) with generic anti-enumeration messages; `delete-own-account` enforces `deleteOwnAccountSchema` (`confirmationPhrase: 'DELETE'` + `currentPassword`), purges `SecureStore` + `queryClient.clear()`, and routes to `(auth)/welcome`.

### 4.2 Pending, Rejected, Suspended & Stale-Session Behavior
Because Supabase JWTs carry up to a `3600s` expiry (`supabase/config.toml`), a user whose account status changes on the server while holding a valid local JWT is handled cleanly across **both** server and client layers:

| Server Account State | Backend Enforcement (Even with Stale Valid JWT) | Mobile Client Stale-Session Detection & Response |
| :--- | :--- | :--- |
| **`pending`** | RLS permits reading own `profiles`/`verification_requests`/own status notifications and public non-PII views ONLY. `can_view_pitch()`, `saved_items`, `companies` write, and Edge `get-signed-document-url` deny (`0` rows / `403`). | Reads `profiles.account_status = 'pending'`; keeps pitch/bookmark TanStack Query hooks disabled (`enabled: isApproved`); routes user to `(auth)/pending-approval` or public-only Discovery mode. |
| **`rejected`** | RLS restricts to reading own `profiles`, `rejection_reason`, `verification_requests`, and submitting `support_requests` (`appeal`). Pitch, Company, and Document reads return `0` rows / `403`. | On boot, `AppState` foreground focus, or Realtime `profiles` update (`UPDATE id=eq.{uid}`): removes any prior deal/pitch cache, routes immediately to `(auth)/rejected` showing sanitized `rejection_reason`, appeal link, and `delete-account`. |
| **`suspended`** | 1) `admin-user-action` executes `auth.admin.signOut(userId, 'global')` revoking refresh tokens + sets `device_tokens.is_active = false`.<br>2) Even before JWT expiration (`<= 1h`), **every** RLS policy checks `is_not_suspended()`/`is_approved_user()` (`false`) returning `0` rows/`42501`, and **every** Edge Function returns `403 ACCOUNT_SUSPENDED`. | 1) Realtime `profiles` event OR foreground profile refresh OR any `403 ACCOUNT_SUSPENDED` / `401` API interceptor immediately runs `queryClient.clear()`.<br>2) Removes local push token registration, clears chunked `SecureStore` session after capturing sanitized suspension state (or signs out cleanly), and hard-locks navigation to `(auth)/suspended` (or `(auth)/login` if refresh token revoked). |

### 4.3 `SecureStore` Chunking, Recovery, Cleanup & Corrupted-Session Handling (`apps/mobile/src/services/secure-storage.ts`)
To prevent silent truncation above Android/iOS `SecureStore`'s `2048`-byte value ceiling:
- **Deterministic Storage Format:**
  - Chunk size capped at **`1800` UTF-8 bytes** (`MAX_CHUNK_BYTES`) leaving safe headroom for key metadata.
  - Manifest key `${storageKey}__meta` stores `JSON.stringify({ v: 1, count, bytes })` (`count` capped `1..32`).
  - Data chunk keys `${storageKey}__chunk_0` .. `${storageKey}__chunk_{count-1}` store base slices.
- **Write & Shrink-Overwrite Cleanup (`setItem`):**
  1. Read previous manifest (if any) to record `prevCount`.
  2. Write all `newCount` chunks sequentially first, then update `${storageKey}__meta`, **then** delete any leftover trailing chunks (`newCount .. prevCount - 1`) and any legacy unchunked `${storageKey}` entry so an interrupted write does not orphan stale chunks cleanly or corrupt prior length bounds.
- **Read, Integrity Check & Corrupted-Session Recovery (`getItem`):**
  1. Attempt manifest read (`${storageKey}__meta`); if absent, fallback once to legacy `${storageKey}` (if present and valid JSON, migrate cleanly on next write).
  2. Validate manifest schema (`v === 1`, integer `1 <= count <= 32`, `bytes > 0`); verify every chunk `0..count-1` exists and reassembled UTF-8 byte length equals `bytes` (plus basic `JSON.parse` validation for Supabase auth sessions).
  3. **On ANY mismatch, missing chunk, JSON parse error, or native Keystore decryption error:** execute full cleanup (`removeItem(storageKey)` purging `__meta`, `__chunk_0..N`, legacy key), emit a scrubbed Sentry breadcrumb (zero token contents), and return `null` cleanly so `AuthContext` boots safely into unauthenticated `(auth)/welcome` instead of crashing in an unrecoverable boot loop.
- **Full Purge (`removeItem`):** Deletes `__meta`, probes & removes `__chunk_0..maxKnown`, and removes legacy `${storageKey}` cleanly on Sign Out, Suspension lockout, or `delete-own-account`.

---

## 5. Domain Services, 13-Module Admin Mapping & Signed URL Lifecycle

### 5.1 Mobile Domain Services
- **Public Directories & Discovery (`directory.repository.ts`):** Queries `public_investors_directory` (`investor_id`, `user_id`, etc. — zero `email`/`phone`/`is_accredited`), `public_companies_directory` (zero `registration_number`/`owner_id`/`admin_feedback`), `public_portfolio_companies_directory`, `sectors`, and `get_public_system_flags()`. Bilingual trigram search queries respect Guest/Pending vs Approved scope.
- **Profile, Investor & Founder Services (`profile.repository.ts`):** `updateOwnProfile` (`updateOwnProfileSchema`), `upsertInvestorProfile` (`upsertInvestorProfileSchema`), `portfolio_companies` CRUD (`upsertPortfolioCompanySchema`), `upsertFounderProfile` (`upsertFounderProfileSchema`). Never mutates protected columns.
- **Company, Members & Verification Services (`company.repository.ts`, `verification.repository.ts`):** Owner/operator company CRUD (`upsertCompanySchema`), `draft`/`rejected` -> `pending` transitions, member invites (`inviteCompanyMemberSchema`), and `verification_requests` creation/listing using explicit safe column projections (`internal_notes` strictly excluded).
- **Pitch, Access Grants, Interests & Bookmarks (`pitch.repository.ts`, `saved.repository.ts`):** `pitches` & `pitch_documents` queries gated `enabled: accountStatus === 'approved'`; founder `upsertPitchSchema`, `founderPitchTransitionSchema`, `createPitchDocumentSchema`; investor `createInvestmentInterestSchema`, founder `updateInvestmentInterestResponseSchema`; optimistic `toggleSavedItemSchema` with rollback on error.
- **Storage, Notifications, Support & Telemetry Services:** Safe upload pre-checks (`storage-upload.ts`), Signed URL viewer (`signed-urls.ts`), Realtime inbox + `device_tokens` + `support_requests` (`notification.repository.ts`, `support.repository.ts`, `notifications.ts`), opt-in EU PostHog (`analytics.ts`), and PII-scrubbed Sentry (`sentry.ts`).

### 5.2 All 13 Admin Governance Domains — Authorization & Atomic Audit Mapping (`apps/admin`)

Every privileged Admin read/write operation enforces `requireAdminContext(requiredScope)` + `assertValidAdminOrigin` and enforces **strict atomic audit consistency**:
- **Atomic RPC / Transaction Preference:** All sensitive admin mutations MUST execute inside an atomic PostgreSQL transaction alongside their immutable `activity_logs` insert (`admin_execute_user_action`, `admin_execute_entity_review`, `admin_update_system_setting`, plus additive `M5.5` transactional RPCs for investor moderation, grant/revoke access, sectors, support triage, and admin role permission edits).
- **Mandatory Audit Failure Semantics (Fail-Closed):** No Server Action or Edge Function may ever silently complete a privileged mutation if `activity_logs` persistence fails. Inside PostgreSQL RPCs, an audit failure aborts and rolls back the entire transaction; inside Edge Functions / Server Actions (`get-signed-document-url`, `send-push-notification`, CSV export), audit write failure aborts the handler cleanly with `500 AUDIT_PERSISTENCE_FAILED` (`errors.auditWriteFailed`) before completing or returning sensitive data.

| # | Admin Module | Required Scope (`admin_roles`) | Backend Execution Mechanism (Edge Function / RPC / Guarded Server Path) | Mandatory `activity_logs` Record |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Overview** (`/overview`) | Any active admin (`is_active_admin()` + per-widget read scopes) | Read-only Server Repository (`users:read`, `companies:read`, `pitches:read`, `audit:read`) bounded counts & SLA queues | None (Read-only dashboard metrics) |
| **2** | **User Management** (`/users`) | `users:read`, `users:review`, `users:suspend`, `roles:manage` | Edge Function **`admin-user-action`** -> RPC `admin_execute_user_action` (+ global sign-out & `device_tokens` deactivation on suspend/reject/demote) & `get-signed-document-url` (`verifications:read`) | Atomic via RPC: `user.approve`, `user.reject`, `user.suspend`, `user.reactivate`, `user.change_role`, `user.assign_admin_role` |
| **3** | **Investor Management** (`/investors`) | `users:read`, `investors:moderate` | Atomic `M5.5` Admin RPC (`admin_moderate_investor`) updating `is_featured` / `is_accredited` / `is_public_listed` + `activity_logs` in single transaction | Atomic via RPC: `investor.featured_toggled`, `investor.accreditation_updated`, `investor.profile_moderated` |
| **4** | **Company Management** (`/companies`) | `companies:read`, `companies:review` | Edge Function **`admin-review-entity`** (`entityType: 'company'`) -> RPC `admin_execute_entity_review` (plus atomic `is_featured` RPC) | Atomic via RPC: `company.approved`, `company.rejected`, `company.suspended`, `company.needs_info`, `company.featured_toggled` |
| **5** | **Company Verification** (`/verifications`) | `verifications:read`, `verifications:review`, `companies:verify` | Edge Function **`admin-review-entity`** (`verification_request` / `company` `verified`) + Edge Function **`get-signed-document-url`** (`verification-documents`, `60s` TTL) + Admin Repository reading `internal_notes` (`verifications:read`) | Atomic via RPC/Edge: `verification_request.*`, `verification.document_viewed` (audited prior to returning URL), `company.verified` |
| **6** | **Pitch Management** (`/pitches`) | `pitches:read`, `pitches:review`, `pitches:restrict` | Edge Function **`admin-review-entity`** (`restricted`/`unrestricted`/`closed`) + Atomic `M5.5` RPC (`admin_manage_pitch_access_grant`) for `pitch_access_grants` (`grantPitchAccessSchema` / `revokePitchAccessSchema`) & `is_featured` | Atomic via RPC: `pitch.restricted`, `pitch.unrestricted`, `pitch.closed`, `pitch_access_grant.created`, `pitch_access_grant.revoked` |
| **7** | **Pitch Review** (`/pitch-reviews`) | `pitches:read`, `pitches:review`, `pitches:restrict` | Edge Function **`admin-review-entity`** (`entityType: 'pitch'`, writing `pitch_reviews` checklist/feedback) + Edge Function **`get-signed-document-url`** for inline preview | Atomic via RPC: `pitch.approved`, `pitch.approved_restricted`, `pitch.needs_info`, `pitch.rejected`, `pitch_document.*_viewed` |
| **8** | **Document Management** (`/documents`) | `pitches:read`, `documents:moderate`, `pitches:restrict` | Edge Function **`admin-review-entity`** (`entityType: 'pitch_document'`: `restricted`/`unrestricted`/`disabled`) + Edge Function **`get-signed-document-url`** (`60s` TTL for restricted) + grant management | Atomic via RPC/Edge: `pitch_document.restricted`, `pitch_document.unrestricted`, `pitch_document.disabled`, `pitch_document.admin_viewed`, `pitch_document.restricted_viewed` |
| **9** | **Notifications** (`/notifications`) | `notifications:send` | Admin Server Action resolves `targetMode` (`user_ids`/`role`/`sector`/`all_approved`) in batches <= 500 -> Edge Function **`send-push-notification`** | Edge Function insert: `notifications.admin_sent` (recipient count & category; zero device tokens logged) |
| **10** | **Admin Roles & Permissions** (`/admin-roles`) | `roles:read`, `roles:manage` (`super_admin` enforced) | Edge Function **`admin-user-action`** (`assign_admin_role` / `change_role`) + Atomic `M5.5` RPC for active permission scope edits (preserving last `super_admin` & self-edit block via `guard_admin_roles_integrity`) | Atomic via RPC: `user.assign_admin_role`, `admin_role.permissions_updated`, `admin_role.revoked` |
| **11** | **Activity Logs** (`/activity-logs`) | `audit:read` | Read-only keyset query (`created_at DESC, id DESC`) + Server Action for filtered CSV export requiring successful `activity_logs` export audit write before returning payload | Append-only (read-only UI; CSV download logs `activity_logs.exported` cleanly first) |
| **12** | **Analytics** (`/analytics`) | `analytics:read` | Read-only privacy-aggregated SQL/repository funnel & SLA counts (`users`, `companies`, `verifications`, `pitches`, `sectors`) | None (Aggregated non-PII reads only) |
| **13** | **System Settings** (`/settings`) | `settings:read`, `settings:write` | Atomic RPC **`public.admin_update_system_setting(...)`** + Atomic `M5.5` RPCs (`admin_upsert_sector`, `admin_triage_support_request`) | Atomic via RPC: `system_settings.update`, `sector.created`, `sector.updated`, `support_request.updated` |

### 5.3 Signed URL Expiration, Re-Authorization & Refresh Lifecycle
- **Strict TTL Caps:** `get-signed-document-url` issues **`60s` TTL** for all `verification-documents` and all confidential/restricted `pitch-documents` (`doc.is_restricted || pitch.status === 'restricted'`), and max **`120s` TTL** (`SIGNED_URL_TTL_SECONDS`) for standard approved pitch documents, always returning `Cache-Control: no-store`.
- **Re-Authorization on Every Call & Refresh:** Neither Mobile nor Admin generates Signed URLs locally or caches expired URLs. When viewing a document in `pitches/[id]/viewer` or Admin preview:
  1. `useSignedDocumentUrl` holds `{ signedUrl, expiresAt, contentType, fileName }` strictly in React component/query memory (`gcTime: 0`, `staleTime: 0`, never persisted to `AsyncStorage`/`SecureStore` or shared temp folders).
  2. Schedules a single timer at `expiresAt - 10_000 ms` (only while mounted and screen active/focused) to invoke `get-signed-document-url` again.
  3. Every refresh re-runs server authorization (`account_status === 'approved'`, grant not revoked/expired, `scan_status !== 'quarantined'`).
  4. If refresh fails with `403 FORBIDDEN`, `403 DOCUMENT_QUARANTINED`, `401`, or `429 RATE_LIMITED`, immediately discards the current `signedUrl` from memory, clears viewer content, and displays the localized access-revoked/rate-limited state with retry (if transient/expired).

---

## 6. Error Handling, Pagination & Validation Contracts

1. **Normalized Errors (`executeServiceCall`):** Wraps Supabase PostgREST, Auth, Storage, and Edge Function errors with `normalizeErrorToEnvelope(err, requestId)` (`@shark/utils`), mapping `42501`/`23505`/`23503`/`23514`/`PGRST116` cleanly and resolving localized `errors.*` / `validation.*` messages through `ar.json`/`en.json`. Never logs JWTs, service keys, or Signed URLs.
2. **Keyset Cursor Pagination:** Directory, feed, inbox, and log repositories enforce `paginationQuerySchema` (`limit` `1..50`, default `20`), fetch `limit + 1` rows aligned to Phase 4 composite indexes (`0005`), and return `buildCursorPage` (`{ items, nextCursor, hasNextPage }`).
3. **Upload & Input Validation:** All mutations parse inputs through `@shark/validation` `.strict()` schemas before any network call; uploads check MIME allowlist, size (`5`/`10`/`25 MiB`), non-zero size, and canonical UUID path formatting prior to Storage upload.

---

## 7. Phased Milestones (`M5.0`–`M5.6`), Acceptance Criteria & Rollback Instructions

### Milestone `M5.0` — Contracts, Env Security & Bilingual Error Keys (`T5-01`–`T5-03`)
- **Acceptance Criteria:** `SendPushNotificationRequest` / `send-push-notification` target dispatch aligned; `apps/mobile` & `apps/admin` `ar.json`/`en.json` contain 100% parity for all `validation.*` & `errors.*` keys; `env.server.ts` (`import 'server-only'`) validates server secrets cleanly; `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, and offline `pnpm build:admin` pass.
- **Rollback / Recovery:** Pure contract/i18n/env refactor commits; revert commit cleanly via `git revert <sha>`, verify `deno check` if `send-push-notification` changed, and re-run `pnpm i18n:check`.

### Milestone `M5.1` — Core Auth, Encrypted Chunked Session & Admin Triple-Gate (`T5-04`–`T5-08`)
- **Acceptance Criteria:** Chunked `SecureStore` passes `4.5 KB+` session, shrink-overwrite, and corrupted-chunk failover tests (`P5-U01`); Mobile `AuthContext` clears query cache immediately upon logout/`rejected`/`suspended`; Admin `middleware.ts`, `requireAdminContext`, `assertValidAdminOrigin`, `/login`, `/unauthorized`, and `(dashboard)/layout.tsx` reject unauthenticated, non-admin, pending, suspended, inactive-role, and out-of-scope actors (`403` / redirect).
- **Rollback / Recovery:** Restore `apps/admin/middleware.ts` stub and isolate/revert `M5.1` branch commit without altering Phase 4 DB migrations (`0001`–`0008` remain untouched). Clear stale test SecureStore keys via app storage reset in dev if testing format changes.

### Milestone `M5.2` — Public Discovery, Sectors, Investor & Founder Services (`T5-09`–`T5-10`)
- **Acceptance Criteria:** All directory queries use non-PII views (`public_investors_directory`, `public_companies_directory`, `public_portfolio_companies_directory`) with keyset cursor pagination and Arabic diacritic search; `investor` and `founder` profile/portfolio CRUD pass `@shark/validation` `.strict()` checks with zero `.select('*')`.
- **Rollback / Recovery:** Stateless query/hook additions; revert `directory.repository.ts`/`profile.repository.ts`/hooks commit cleanly; stale TanStack Query entries cleared by cache key version bump.

### Milestone `M5.3` — Company, KYB Verification, Pitch & Deal-Flow Services (`T5-11`–`T5-12`)
- **Acceptance Criteria:** Pending users cannot fire pitch/bookmark queries (`enabled: isApproved`); `verification_requests` projections omit `internal_notes` (`G5-04`); founders can manage `draft`/`rejected`/`pending`/`closed` company & pitch lifecycles; investors can toggle bookmarks and submit/withdraw `investment_interests`; static repo scan confirms zero `.select('*')`.
- **Rollback / Recovery:** Revert repository/hook commit; if stale draft/test records remain in ephemeral/staging DB during integration testing, run `supabase db reset` (local) or delete synthetic test rows in staging (`NEVER` production).

### Milestone `M5.4` — Private Storage, Signed URLs, Push, Realtime & Telemetry (`T5-13`–`T5-16`)
- **Acceptance Criteria:** Canonical UUID uploads (`verification-documents`, `pitch-documents`, `public-assets`) enforce MIME/size/path guards pre-upload; `useSignedDocumentUrl` auto-refreshes before `60s`/`120s` TTL and drops URLs immediately on revoke/quarantine/unmount; Realtime inbox + `device_tokens` cleanup on logout work cleanly; Sentry strips auth/token PII; PostHog initializes ONLY when `analytics_opt_in === true`.
- **Rollback / Recovery:** Disable push/analytics features cleanly via `analytics_opt_in` / env flag, clean orphaned test objects inside local/staging storage buckets via Storage admin API, and revert `M5.4` commit.

### Milestone `M5.5` — Admin Governance Services & Audited Server Actions (`T5-17`–`T5-19`)
- **Acceptance Criteria:** Server-only repositories and Server Actions cover all 13 Admin governance domains in Section 5.2; every mutating action checks `assertValidAdminOrigin` + `requireAdminContext(scope)` + Zod `.strict()` schema and records `activity_logs` (atomically via RPC/Edge or paired server audit write); `pnpm build:admin` contains zero leaked secrets.
- **Rollback / Recovery:** Server Actions & `server-only` repositories have zero Admin module UI consumers until Phase 6; revert `src/actions/*` and `src/repositories/*` cleanly; restore clean staging/local audit test fixture state via `supabase db reset`.

### Milestone `M5.6` — Mobile Route Integration & Final Phase 5 Verification Gate (`T5-20`–`T5-22`)
- **Acceptance Criteria:** Mobile Auth (11 routes), 5-tab navigation, detail/viewer screens, `search`, `sectors/[slug]`, and 10 `account/*` routes execute live against Supabase in Arabic (`ar` RTL) and English (`en` LTR) using Phase 3 primitives cleanly; all Tier 1–4 unit, live integration, security, build (`next build` + Android `expo export`), and GitHub Actions CI gates pass with exit code `0`.
- **Rollback / Recovery:** Isolate mobile route wiring per feature group (`(auth)`, `(tabs)`, `account`); roll back failing route group commit cleanly while preserving tested `M5.0`–`M5.5` service layers; verify clean `_layout.tsx` fallback to Phase 3 entrypoint if temporary rollback is needed.

---

## 8. Environment Isolation & Continuous Integration Strategy

### 8.1 Strict Separation of Local, Test/Staging & Production Supabase Environments

| Environment | Purpose | Seed & Fixture Policy | `P5-ENV-GUARD` Enforcement Rule |
| :--- | :--- | :--- | :--- |
| **Local Docker / CI Runner** (`127.0.0.1:54321–54322`) | **Default** target for all Phase 5 integration & security tests | Applies `seed_reference.sql` + synthetic `@shark.test` `seed_dev_fixtures.sql` | Used automatically unless explicit Staging opt-in is enabled; destroyed on `supabase stop`. |
| **Staging Supabase** (Separate Non-Prod Project Ref) | Pre-release mobile/admin manual QA & opt-in staging checks | Applies `seed_reference.sql` + isolated synthetic staging accounts ONLY | Permitted **ONLY** when `ALLOW_STAGING_INTEGRATION_TESTS=true`, `APP_ENV=staging`, and isolated staging credentials are supplied. Never falls through silently from default local mode. |
| **Production Supabase** (Managed Launch Environment) | Live customer traffic only | Strictly `seed_reference.sql`; **NEVER** `seed_dev_fixtures.sql` | **Unconditional Abort:** Any production `APP_ENV=production`, `SUPABASE_PRODUCTION_PROJECT_REF` match, or non-local/non-opt-in-staging remote URL immediately aborts tests regardless of opt-in flags. |

### 8.2 CI Pipeline Execution for Phase 5 Tests
1. **Static, Unit & Build Gate ([.github/workflows/ci-quality.yml](file:///C:/DEV/shark-investment-network/.github/workflows/ci-quality.yml)):** Runs `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (including `P5-U01`–`P5-U06` & static repo hygiene), `pnpm i18n:check`, scoped secret scan (`apps/ packages/ supabase/ .env.example`), `pnpm build:admin`, and Mobile Expo bundle verification cleanly on every push/PR to `main`.
2. **Live Integration & Security Gate ([.github/workflows/supabase-verify.yml](file:///C:/DEV/shark-investment-network/.github/workflows/supabase-verify.yml)):** Updated in `T5-22` (adding triggers on `apps/**`, `packages/**`, `tests/**` cleanly) to boot Docker Supabase (`supabase start`, `supabase db reset`), run `deno check`, execute all 9 pgTAP suites (`72` assertions), **and** execute `tests/integration/*.test.ts` + security suite (`P5-I01`–`P5-I07`, `P5-S01`–`P5-S05`) directly against live local `http://127.0.0.1:54321` using local-only CLI keys (`supabase status -o env`), failing the workflow on any skipped or failed assertion.
