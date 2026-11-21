# Phase 5 Task Breakdown — Backend Integration & Application Services

> **Document Status:** Finalized Phase 5 Task Breakdown (Awaiting Project Manager Approval Before `M5.0`)
> **Governing Charter:** [AGENTS.md](../AGENTS.md) (§2 Agent Ownership & §4 Standards) | **Master Plan:** [PHASE_5_PLAN.md](./PHASE_5_PLAN.md) | **Verification Matrix:** [PHASE_5_TEST_PLAN.md](./PHASE_5_TEST_PLAN.md)

---

## Agent Ownership Legend (Per `AGENTS.md` §2)
- **Agent 3 (Mobile Engineer):** `apps/mobile/**`
- **Agent 4 (Backend / Shared Contracts Engineer):** `packages/shared-types/**`, `packages/validation/**`, `packages/utils/**`, `supabase/functions/**`, `.github/workflows/supabase-verify.yml`
- **Agent 5 (Admin Engineer):** `apps/admin/**`
- **Agent 6 (QA & Security Engineer):** `tests/**`, CI & security verification gates
- **Agent 2 (UI/UX Reviewer):** Bilingual `ar`/`en` RTL UX & accessibility review

---

## Milestone `M5.0` — Shared Contracts Alignment, Env Validation & Bilingual Error Keys

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-01** | **Align Notification Dispatch Contract (`G5-01`)** — Resolve `targetMode` (`user_ids`/`role`/`sector`/`all_approved`) cleanly with `SendPushNotificationRequest` (`@shark/shared-types`) and `sendPushNotificationSchema` (`@shark/validation`) in bounded `<= 500` batches matching `send-push-notification/index.ts`. Sync API docs if extended. | Agent 4 (Agent 5, Agent 6) | Phase 4 | `supabase/functions/send-push-notification/index.ts`, `packages/shared-types/src/notifications.ts`, `docs/API_DOCUMENTATION.md` | `deno check` & `shared-contracts.test.ts` pass; Admin Server Action payloads match Edge Function contract 100%. |
| **T5-02** | **Add `validation.*` & `errors.*` Bilingual Dictionaries (`G5-02`)** — Add full `ar` and `en` message mappings for every Zod key in `@shark/validation`, every error code in `KNOWN_DB_CODE_MAP` (`@shark/utils`), and every Edge Function error code. | Agent 3 (`mobile`), Agent 5 (`admin`), Agent 2 | Phase 4 | `apps/mobile/src/i18n/{ar,en}.json`, `apps/admin/src/i18n/{ar,en}.json`, `apps/mobile/src/i18n/index.ts`, `apps/admin/src/i18n/index.ts` | `pnpm i18n:check` passes; helper falls back cleanly to `errors.unexpected` on unknown keys. |
| **T5-03** | **Harden Env Validation Helpers (`G5-05`)** — Add lazy runtime validation (`assertMobileSupabaseEnv`, `assertAdminPublicEnv`) and create server-only `env.server.ts` validating `adminServerEnvSchema` (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ALLOWED_ORIGINS`, optional `APP_ENV`). | Agent 3 (`mobile`), Agent 5 (`admin`), Agent 6 | Phase 4 | `apps/mobile/src/services/env.ts`, `apps/admin/src/lib/env.ts`, `apps/admin/src/lib/env.server.ts` | `pnpm build:admin` succeeds offline with CI placeholders; runtime fails closed if real env missing or misconfigured. |

*Rollback (`M5.0`): Revert commit via `git revert <sha>`; re-run `pnpm i18n:check` and `shared-contracts.test.ts`.*

---

## Milestone `M5.1` — Core Auth, Chunked Session Persistence & Admin Triple-Gate

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-04** | **Chunked `SecureStore` Adapter & Corruption Recovery (`G5-03`)** — Implement `SupabaseStorageAdapter` wrapping `expo-secure-store` with `1800`-byte UTF-8 chunks, `__meta` manifest `{ v: 1, count, bytes }`, trailing-chunk cleanup on overwrite shrink, legacy key migration, and corrupt/missing-chunk recovery purge. | Agent 3 (Agent 6) | `T5-03` | `apps/mobile/src/services/secure-storage.ts` | `P5-U01` verifies `4.5 KB+` JWT persistence, shrink cleanup, corrupt-chunk failover (`null` without boot crash), and complete wipe. |
| **T5-05** | **Mobile Supabase Client, Query Client & Service Wrapper** — Create typed mobile `supabase` client (anon key, PKCE, `detectSessionInUrl: false`, chunked `SecureStore`), TanStack Query defaults, and normalized `executeServiceCall` wrapper (`normalizeErrorToEnvelope` + global `401`/`403 ACCOUNT_SUSPENDED` callback). | Agent 3 (Agent 4) | `T5-02`, `T5-04` | `apps/mobile/src/services/supabase.ts`, `apps/mobile/src/services/service-client.ts`, `apps/mobile/src/services/query-client.ts` | Zero `service_role` references; zero raw PostgreSQL text exposed to UI hooks. |
| **T5-06** | **Mobile Auth Repository & Stale-Session Sync (`AuthContext`)** — Implement `signUp`, `signIn`, `signOut`, `resetPasswordForEmail`, `updatePassword`, `selectAccountRole`, `fetchOwnProfile`, `deleteOwnAccount` (`delete-own-account` Edge Function). Wire `AuthProvider` with `onAuthStateChange`, `AppState` foreground refresh, Realtime `profiles` listener, and immediate `queryClient.clear()` + lock/purge on `suspended` / `rejected` / sign-out. | Agent 3 (Agent 4, Agent 6) | `T5-05` | `apps/mobile/src/repositories/auth.repository.ts`, `apps/mobile/src/hooks/useAuth.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx` | Stale valid JWTs on `suspended`/`rejected` accounts immediately drop protected queries, purge cache, and enforce status routes. |
| **T5-07** | **Admin `@supabase/ssr` Clients & Active `middleware.ts`** — Implement `client.ts` (browser anon key), `server.ts` (SSR cookie client), `admin.ts` (`import 'server-only'`, service role client), and `middleware.ts` calling `supabase.auth.getUser()` to refresh cookies and block unauthenticated dashboard access. | Agent 5 (Agent 6) | `T5-03` | `apps/admin/src/lib/supabase/{client,server,admin}.ts`, `apps/admin/middleware.ts` | Browser bundle excludes all server keys; unauthenticated requests to protected routes redirect to `/login`. |
| **T5-08** | **Admin Triple-Gate Guards & Auth Pages (`/login`, `/unauthorized`)** — Implement `requireAdminContext(requiredScope?)`, `assertValidAdminOrigin(headers)` (`ADMIN_ALLOWED_ORIGINS`), Admin `(auth)/login` & `(auth)/unauthorized`, and `(dashboard)/layout.tsx` live verification (`role === 'admin' && account_status === 'approved' && active admin_roles`). | Agent 5 (Agent 6, Agent 2) | `T5-07`, `T5-02` | `apps/admin/src/lib/auth/guards.ts`, `apps/admin/src/app/(auth)/login/page.tsx`, `apps/admin/src/app/(auth)/unauthorized/page.tsx`, `apps/admin/src/app/(dashboard)/layout.tsx` | Non-admin, pending, suspended, inactive-admin, and cross-origin requests fail server-side (`403` / `/unauthorized`). |

*Rollback (`M5.1`): Revert `M5.1` commit; restore `apps/admin/middleware.ts` pass-through stub cleanly while keeping Phase 4 DB unchanged.*

---

## Milestone `M5.2` — Public Discovery, Sectors, Investor & Founder Services

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-09** | **Public Reference, Directory & Trigram Search Repository (Mobile)** — Implement `sectors`, `get_public_system_flags()`, `public_investors_directory` (`investor_id`), `public_companies_directory`, `public_portfolio_companies_directory`, and bilingual search with `buildCursorPage` keyset pagination (`limit <= 50`). | Agent 3 (Agent 4) | `T5-05` | `apps/mobile/src/repositories/directory.repository.ts`, `apps/mobile/src/hooks/useDiscovery.ts`, `apps/mobile/src/hooks/useSearch.ts` | Guests & Pending users read zero PII (`email`, `phone`, `registration_number`) and zero pitches; pagination order matches `0005` indexes. |
| **T5-10** | **Profile, Investor & Founder Repositories + Hooks** — Implement `updateOwnProfile` (`updateOwnProfileSchema`), `upsertInvestorProfile`, `portfolio_companies` CRUD, and `upsertFounderProfile` with TanStack Query cache invalidation. | Agent 3 (Agent 4) | `T5-06`, `T5-09` | `apps/mobile/src/repositories/profile.repository.ts`, `apps/mobile/src/hooks/useProfile.ts` | Protected privilege fields never sent; portfolio count updates cleanly via DB trigger. |

*Rollback (`M5.2`): Revert `directory`/`profile` repositories and hooks; zero DB migrations impacted.*

---

## Milestone `M5.3` — Company, KYB Verification, Pitch & Deal-Flow Services

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-11** | **Company, Members & Verification Repository + Hooks** — Implement founder company CRUD (`upsertCompanySchema`), `draft`/`rejected` -> `pending` submit, member invites (`inviteCompanyMemberSchema`), and `verification_requests` with explicit safe `SELECT_COLUMNS` excluding `internal_notes` (`G5-04`). | Agent 3 (Agent 4, Agent 6) | `T5-10` | `apps/mobile/src/repositories/company.repository.ts`, `apps/mobile/src/repositories/verification.repository.ts`, `apps/mobile/src/hooks/useCompany.ts` | Pending users submit identity verification cleanly; `internal_notes` never selected from Mobile. |
| **T5-12** | **Pitch, Document Metadata, Grants, Interests & Saved Repository + Hooks** — Implement approved-gated `pitches` list/detail (`enabled: isApproved`), non-internal `pitch_reviews`, founder `upsertPitch`/`transitionPitch`/`deleteDraftPitch`, `createPitchDocument`, `investment_interests`, and `saved_items` optimistic toggle. | Agent 3 (Agent 4, Agent 6) | `T5-11` | `apps/mobile/src/repositories/pitch.repository.ts`, `apps/mobile/src/repositories/saved.repository.ts`, `apps/mobile/src/hooks/usePitches.ts`, `apps/mobile/src/hooks/useSavedItems.ts` | Non-approved sessions execute zero pitch queries; restricted docs show lock UI cleanly without grants. |

*Rollback (`M5.3`): Revert `company`/`verification`/`pitch`/`saved` repositories and hooks; clean synthetic test rows in staging or run `supabase db reset` locally.*

---

## Milestone `M5.4` — Private Storage, Signed URLs, Push, Realtime & Telemetry

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-13** | **Storage Upload Service (`public-assets`, `verification-documents`, `pitch-documents`)** — Pre-validate extension/MIME/size (`5`/`10`/`25 MiB`), build canonical UUID storage paths, compute SHA-256 on pitch docs, and upload via Supabase Storage SDK. | Agent 3 (Agent 6) | `T5-05` | `apps/mobile/src/services/storage-upload.ts` | Traversal/`0`-byte/oversized/`.svg` rejected synchronously prior to HTTP upload (`P5-U06`). |
| **T5-14** | **Signed URL Service & Auto-Refresh Viewer Hook** — Invoke Edge Function `get-signed-document-url`, keep URL strictly in memory (`gcTime: 0`), refresh proactively at `expiresAt - 10_000 ms` while mounted/focused, and clear + lock immediately on `403`/`404`/`429` or unmount. | Agent 3 (Agent 6) | `T5-06`, `T5-12` | `apps/mobile/src/services/signed-urls.ts`, `apps/mobile/src/hooks/useSignedDocumentUrl.ts` | `60s`/`120s` TTL enforced; revoked/quarantined docs clear viewer immediately; zero disk persistence. |
| **T5-15** | **Notifications, Push Tokens, Realtime Inbox & Support Service** — Implement paginated `notifications` repo + Realtime `INSERT` subscription, mark-read/soft-delete, `device_tokens` upsert/deactivation via `expo-notifications`, deep-link path guard, and `support_requests` submission. | Agent 3 (Agent 4) | `T5-06` | `apps/mobile/src/repositories/{notification,support}.repository.ts`, `apps/mobile/src/services/notifications.ts`, `apps/mobile/src/hooks/useNotifications.ts` | Unread count syncs live; deep links validated as relative paths; sign-out deactivates active device token. |
| **T5-16** | **Sentry PII Redaction & Opt-In PostHog EU Telemetry** — Scrub query tokens/signedUrls/emails inside `sentry.ts` `beforeSend` and wire opt-in PostHog EU ingestion (`analytics_opt_in === true`, autocapture disabled) inside `analytics.ts`. | Agent 3 (Agent 6) | `T5-06` | `apps/mobile/src/services/sentry.ts`, `apps/mobile/src/services/analytics.ts` | Zero telemetry dispatched when opted out (`P5-U05`); zero secrets/emails in Sentry events. |

*Rollback (`M5.4`): Revert `M5.4` services/hooks; revoke temporary test objects in private staging/local buckets if needed.*

---

## Milestone `M5.5` — Admin Privileged Services & Audited Server Actions (Backend Layer for Phase 6)

> **Boundary Note:** All 13 Admin Web UI dashboard screens stay strictly in **Phase 6**. `M5.5` builds & verifies the `server-only` repositories and Server Actions matching Section 5.2 of `PHASE_5_PLAN.md`.

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-17** | **Admin Users, Investors, Verifications & Roles Services + Actions (Modules 2, 3, 5, 10)** — Build `server-only` repositories (`users`, `investors`, `verifications` including `internal_notes` when `verifications:read`, `admin_roles`) and Server Actions (`adminUserAction` -> Edge `admin-user-action`, `moderateInvestor`, `adminReviewVerification` -> Edge `admin-review-entity`, `getAdminSignedDocumentUrl`, role permission updates writing immutable `activity_logs`). | Agent 5 (Agent 6) | `T5-08` | `apps/admin/src/repositories/{users,investors,verifications,admin-roles}.repository.ts`, `apps/admin/src/actions/{users,investors,verifications,admin-roles}.ts` | `requireAdminContext(scope)` + `assertValidAdminOrigin` + self-target check + audit logs verified across every action. |
| **T5-18** | **Admin Companies, Pitches, Reviews & Documents Services + Actions (Modules 4, 6, 7, 8)** — Build `server-only` repositories (`companies`, `pitches`, `pitch_reviews`, `pitch_documents`, `pitch_access_grants`) and Server Actions (`adminReviewCompany`, `adminReviewPitch`, `adminReviewDocument` via Edge `admin-review-entity`, `grantPitchAccess`/`revokePitchAccess`, `toggleFeaturedEntity` with audit log entries). | Agent 5 (Agent 6) | `T5-17` | `apps/admin/src/repositories/{companies,pitches,documents}.repository.ts`, `apps/admin/src/actions/{companies,pitches,documents}.ts` | Adverse decisions require `>= 10` chars; grant/revoke & feature toggles write immutable `activity_logs`. |
| **T5-19** | **Admin Overview, Notifications, Audit, Analytics & Settings Services + Actions (Modules 1, 9, 11, 12, 13)** — Build `server-only` overview SLA & privacy-safe analytics repositories (`analytics:read`), notification broadcaster (`T5-01` target resolution -> Edge `send-push-notification`), `activity_logs` keyset explorer + CSV export audit logging (`audit:read`), `sectors` CRUD + `admin_update_system_setting` RPC action (`settings:write`), and `support_requests` triage (`support:manage`). | Agent 5 (Agent 6) | `T5-17`, `T5-01` | `apps/admin/src/repositories/{overview,notifications,audit,analytics,settings,support}.repository.ts`, `apps/admin/src/actions/{notifications,audit,settings,support}.ts` | Every module 1–13 permission scope & `activity_logs` audit mapping matches `PHASE_5_PLAN.md` §5.2 100%. |

*Rollback (`M5.5`): Revert `apps/admin/src/repositories/*` and `apps/admin/src/actions/*` cleanly; zero Admin Dashboard pages touched.*

---

## Milestone `M5.6` — Mobile Route Composition, Wiring & Phase 5 Test Gate

| Task ID | Title & Concrete Scope | Owner (Reviewer) | Depends On | Target File Paths | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T5-20** | **Compose & Connect Mobile Auth Routes (11 Routes)** — Compose `welcome`, `login`, `register`, `account-type`, `profile-setup`, `verification`, `pending-approval`, `rejected`, `suspended`, `forgot-password`, `reset-password` from existing Phase 3 UI primitives and wire to `AuthContext`, `@shark/validation`, and `storage-upload.ts`. | Agent 3 (Agent 2, Agent 6) | `T5-06`, `T5-11`, `T5-13` | `apps/mobile/app/(auth)/**` | Bilingual `ar` RTL & `en` LTR functional; zero hardcoded strings; handles all status & recovery redirects cleanly. |
| **T5-21** | **Compose & Connect Mobile Tabs, Detail/Viewer, Search, Sectors & 10 Account Routes** — Compose `(tabs)/{discovery,investors,companies,pitches,account}`, `investors/[id]`, `companies/[id]`, `pitches/[id]`, `pitches/[id]/viewer` (with watermark + Signed URL refresh), `search`, `sectors/[slug]`, and all 10 `account/*` screens using Phase 3 UI/Card primitives and wire to `M5.2`–`M5.4` hooks. | Agent 3 (Agent 2, Agent 6) | `T5-09`–`T5-16`, `T5-20` | `apps/mobile/app/(tabs)/**`, `apps/mobile/app/investors/**`, `apps/mobile/app/companies/**`, `apps/mobile/app/pitches/**`, `apps/mobile/app/account/**`, `apps/mobile/app/{search,sectors}/**` | User Journeys 1–4 execute cleanly end-to-end against local/staging Supabase; zero `.select('*')`; RTL/LTR clean. |
| **T5-22** | **Phase 5 Automated Unit, Integration, Security & CI Suite** — Author Vitest unit/static hygiene tests (`P5-U01`–`P5-U07`), live Supabase integration tests (`P5-I01`–`P5-I08`), app-layer security boundary tests (`P5-S01`–`P5-S05`), wire live integration job in `.github/workflows/supabase-verify.yml` (strictly `APP_ENV !== 'production'`), and pass all CLI & CI exit checks. | Agent 6 (Agent 3, Agent 4, Agent 5) | `T5-19`, `T5-21` | `tests/services/**`, `tests/integration/**`, `tests/security/**`, `.github/workflows/supabase-verify.yml` | All local quality checks, Android export, `next build`, and live Docker CI integration/security suites exit `0`. |

*Rollback (`M5.6`): Isolate route rollbacks per group (`(auth)`, `(tabs)`, `account`); keep tested `M5.0`–`M5.5` layers intact and preserve `_layout.tsx` safe fallback.*
