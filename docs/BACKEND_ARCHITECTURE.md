# Backend Architecture, Security & Operations Guide — SHARK Investment Network

> **Phase:** Phase 4 — Backend Architecture, Database, Security & Shared Contracts
> **Platform:** Supabase (PostgreSQL 15, Supabase Auth, Row Level Security, Storage, Deno Edge Functions) — **Zero Firebase dependencies**
> **Canonical Sources:** [AGENTS.md](../AGENTS.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [DATABASE.md](./DATABASE.md) | [SECURITY.md](./SECURITY.md) | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 1. Supabase Architecture Overview

SHARK Investment Network uses Supabase strictly as its unified backend platform across both applications (`apps/mobile` and `apps/admin`):

```text
apps/mobile (Expo + Anon Key) ──┐
                                ├──► Supabase PostgREST + Auth + RLS (20 public tables, FORCE RLS)
apps/admin  (Next.js + SSR/RSA)─┤
                                └──► Supabase Edge Functions (Deno + Zod + Service Role)
                                         ├── get-signed-document-url
                                         ├── admin-user-action
                                         ├── admin-review-entity
                                         ├── send-push-notification
                                         └── delete-own-account
```

### Non-Negotiable Security Boundaries
1. **Strict Separation of Role vs. Status:** `user_role` (`investor | founder | member | admin`) and `account_status` (`pending | approved | rejected | suspended`) are independent. All self-registrations start as `pending`, and signup triggers downgrade forged `admin` metadata to `member`.
2. **Backend-Only Enforcement:** UI guards in React Native or Next.js are strictly UX conveniences. Real authorization lives inside PostgreSQL `FORCE ROW LEVEL SECURITY`, `BEFORE INSERT/UPDATE/DELETE` security triggers, `SECURITY DEFINER` RPCs, and Edge Functions.
3. **Zero Client Secret Exposure:** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `INTERNAL_EDGE_SECRET`, and `EXPO_ACCESS_TOKEN` are never stored in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variables.

---

## 2. Database Schema Summary (`supabase/migrations/`)

All 20 canonical `public` tables, 23 PostgreSQL enums, and 1 internal operational table (`private_internal.rate_limit_events`) from [DATABASE.md](./DATABASE.md) are defined across 8 sequential SQL migrations:

| Migration | Contents |
| :--- | :--- |
| `0001_extensions_and_enums.sql` | `pgcrypto`, `pg_trgm`, `unaccent`, `private_internal` schema, `normalize_arabic_text()`, 23 enums |
| `0002_core_tables.sql` | `sectors`, `profiles`, `investors`, `founders`, `companies`, `company_members` |
| `0003_deal_flow_and_governance_tables.sql` | `pitches`, `pitch_documents`, `pitch_reviews`, `pitch_access_grants`, `investment_interests`, `portfolio_companies`, `saved_items` |
| `0004_ops_notifications_and_audit_tables.sql` | `notifications`, `device_tokens`, `verification_requests`, `admin_roles`, `activity_logs`, `system_settings`, `support_requests`, `private_internal.rate_limit_events` |
| `0005_indexes_and_search.sql` | 34 composite, partial-unique, array GIN, and Arabic-normalized `gin_trgm_ops` indexes |
| `0006_triggers_and_guards.sql` | 14 fail-closed integrity triggers, privilege-column guards, `updated_at` sync, `activity_logs` append-only immutability |
| `0007_rls_helpers_views_and_policies.sql` | 6 `SECURITY DEFINER` helpers, 3 non-PII public views, `FORCE ROW LEVEL SECURITY` on all 20 tables, column revocations, atomic RPCs |
| `0008_storage_buckets_and_policies.sql` | 3 Storage buckets, `try_parse_uuid()` crash-proof path parser, zero client `SELECT` on private buckets |

---

## 3. Authentication & Authorization Model

1. **JWT Verification:** Edge Functions always validate tokens live via `authClient.auth.getUser(jwt)` and query live `profiles` (`deleted_at IS NULL`, `account_status != 'suspended'`). Stale JWT claims alone never authorize privileged actions.
2. **Admin Triple-Gate (`is_active_admin(scope)` & `assertActiveAdminScope`):**
   - `profiles.role = 'admin'`
   - `profiles.account_status = 'approved'` AND `profiles.deleted_at IS NULL`
   - Active non-deleted `admin_roles` record containing `super_admin` or the exact required scope (`users:review`, `users:suspend`, `roles:manage`, `companies:verify`, `pitches:restrict`, `documents:moderate`, etc.).
3. **Privilege Column Protection:** Database triggers (`guard_profile_sensitive_columns`, `guard_company_integrity`, `guard_pitch_integrity`, `guard_admin_roles_integrity`) reject self-approval, role escalation, or status forgery by authenticated clients unless executed through an explicit internal `service_role` / `SECURITY DEFINER` RPC path.
4. **Immutable Audit Trail:** `prevent_activity_logs_mutation()` rejects all `UPDATE` and `DELETE` operations on `public.activity_logs` (except `actor_id -> NULL` during `ON DELETE SET NULL` user erasure). Sensitive keys are redacted via `redactForAudit()`.

---

## 4. Row Level Security & Column Isolation

- Every table in `public` (20 / 20) runs `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`.
- Anonymous (`anon`) users have **zero `SELECT` access** on `profiles`, `investors`, `founders`, `companies`, `pitches`, `pitch_documents`, `activity_logs`, or `verification_requests`. Public discovery uses `public_investors_directory`, `public_companies_directory`, `public_portfolio_companies_directory`, and `get_public_system_flags()`.
- `verification_requests.internal_notes` is revoked at the PostgreSQL column level (`REVOKE SELECT (internal_notes) ... FROM PUBLIC, anon, authenticated`).
- Restricted pitches (`status = 'restricted'`) and confidential documents (`is_restricted = true`) require either company operator membership, authorized admin review scope, or an active, unrevoked, non-expired `pitch_access_grants` record.

---

## 5. Storage Security Model

| Bucket | Visibility | Max Size | Allowed MIME Types | Read Path |
| :--- | :--- | :--- | :--- | :--- |
| `public-assets` | Public | `5 MiB` | `image/jpeg`, `image/png`, `image/webp` | Direct CDN read; path-scoped owner/operator write |
| `pitch-documents` | **Private** | `25 MiB` | `application/pdf`, `.pptx`, `.xlsx`, `image/png`, `image/jpeg` | **Short-lived Signed URL only** (`get-signed-document-url`) |
| `verification-documents` | **Private** | `10 MiB` | `application/pdf`, `image/jpeg`, `image/png` | **Short-lived Signed URL only** (`60s` TTL) |

- Private buckets define **zero** `FOR SELECT` policies on `storage.objects` for `anon` or `authenticated`.
- Canonical object paths are validated using regex + `public.try_parse_uuid()` so malformed paths safely evaluate `NULL` instead of raising SQL cast errors.
- `_shared/magic-bytes.ts` verifies binary signatures (`%PDF-`, PNG, JPEG, RIFF/WEBP, OOXML `PK`) and blocks embedded `<svg>`/`<script>` payloads.

---

## 6. Environment Setup Guide

### 6.1 Templates (Committed, Placeholder-Only)
- Root CI/Backend template: [`.env.example`](../.env.example)
- Mobile client template: [`apps/mobile/.env.example`](../apps/mobile/.env.example) (`EXPO_PUBLIC_*` only)
- Admin portal template: [`apps/admin/.env.example`](../apps/admin/.env.example) (`NEXT_PUBLIC_*` + server-only secrets)

### 6.2 Local Development (Docker + Supabase CLI)
1. Copy `.env.example` to `.env`, `apps/mobile/.env.example` to `apps/mobile/.env.local`, and `apps/admin/.env.example` to `apps/admin/.env.local`. Never commit `.env` or `.env.local` files.
2. Start local Supabase containers (requires Docker Engine / Docker Desktop):
   ```bash
   npx supabase start
   ```
3. Apply migrations `0001`–`0008` and load deterministic reference + non-production `@shark.test` seed fixtures configured in `supabase/config.toml` `[db.seed]`:
   ```bash
   npx supabase db reset --local
   ```
4. Run pgTAP security verification tests (`SEC-01` through `SEC-11`):
   ```bash
   npx supabase test db
   ```
5. Serve Edge Functions locally:
   ```bash
   npx supabase functions serve --env-file .env
   ```

### 6.3 Remote Staging / Production Deployment
1. Link the project reference cleanly via CLI login (never store tokens in Git):
   ```bash
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```
2. Set Edge Function secrets exclusively in Supabase Secrets Manager (`SUPABASE_SERVICE_ROLE_KEY`, `EXPO_ACCESS_TOKEN`, `INTERNAL_EDGE_SECRET`, `IP_HASH_SALT`, `SIGNED_URL_TTL_SECONDS`, `ALLOWED_CORS_ORIGINS`).
3. Verify schema diff before pushing:
   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```
4. Deploy Edge Functions (`verify_jwt` handled explicitly per endpoint):
   ```bash
   npx supabase functions deploy get-signed-document-url admin-user-action admin-review-entity send-push-notification delete-own-account
   ```
5. **Production Seed Rule:** Apply ONLY [`supabase/seed/seed_reference.sql`](../supabase/seed/seed_reference.sql) to staging/production. **NEVER** apply [`supabase/seed/seed_dev_fixtures.sql`](../supabase/seed/seed_dev_fixtures.sql) outside ephemeral local/CI test databases.

---

## 7. Migration & Rollback Instructions

### Forward Execution Order
1. `0001_extensions_and_enums.sql`
2. `0002_core_tables.sql`
3. `0003_deal_flow_and_governance_tables.sql`
4. `0004_ops_notifications_and_audit_tables.sql`
5. `0005_indexes_and_search.sql`
6. `0006_triggers_and_guards.sql`
7. `0007_rls_helpers_views_and_policies.sql`
8. `0008_storage_buckets_and_policies.sql`

### Safe Rollback Procedure
Because Phase 4 migrations create stateful security foundations (`FORCE RLS`, `activity_logs` immutability triggers, and `auth.users` triggers):
- **Local Development:** Reset cleanly to base migration state:
  ```bash
  npx supabase db reset --local
  ```
- **Staging / Production Pre-Release Rollback:**
  1. Take a Supabase PITR (Point-in-Time Recovery) snapshot prior to every `supabase db push`.
  2. Never run destructive `DROP TABLE` scripts manually in production; add an additive corrective migration (`0009_*`) for policy/function fixes or restore from PITR snapshot if schema revert is required.
  3. If rolling back triggers (`0006`), RLS policies (`0007`), or storage rules (`0008`) on a non-production database during testing, drop objects in reverse dependency order (`0008` storage policies -> `0007` policies/views/RPCs -> `0006` triggers -> `0005` indexes -> `0004`–`0002` tables -> `0001` enums) and verify `public.activity_logs` archival backup first.

---

## 8. Security Test Matrix (`SEC-01` – `SEC-11`)

| Suite | Target File | Coverage |
| :--- | :--- | :--- |
| `SEC-01` | `supabase/tests/01_guest_isolation_sec01.sql` | Anon directory access, zero-PII columns, raw table blocks |
| `SEC-02` | `supabase/tests/02_role_escalation_and_self_approval_sec02.sql` | Forged `admin` signup downgrade, self-role/status mutation block |
| `SEC-03/04` | `supabase/tests/03_pending_and_rejected_gate_sec03_04.sql` | Pending/rejected pitch & company creation blocks, support appeal allowance |
| `SEC-05` | `supabase/tests/04_suspended_revocation_sec05.sql` | Instant suspension access revocation across pitches/documents/mutations |
| `SEC-06` | `supabase/tests/05_cross_tenant_idor_sec06.sql` | Cross-tenant profile, notification, saved item, company, and interest IDOR blocks |
| `SEC-07` | `supabase/tests/06_restricted_pitch_and_docs_sec07.sql` | Restricted pitch/document grant requirement + immediate expiration check |
| `SEC-08` | `supabase/tests/07_storage_isolation_sec08.sql` | Bucket `public=false` checks, zero private `SELECT` policies, `try_parse_uuid` safety |
| `SEC-09/10` | `supabase/tests/08_founder_and_admin_boundaries_sec09_10.sql` | Founder self-approval prevention, least-privilege admin scopes, self-action block |
| `SEC-11` | `supabase/tests/09_audit_immutability_sec11.sql` | `FORCE RLS` on all 20 tables, column-level `internal_notes` revocation, append-only `activity_logs` |
| Static + Unit | `tests/contracts/shared-contracts.test.ts` & `tests/security/backend-guards.test.ts` | Zod strict schemas, magic bytes, signed URL TTLs, RLS/storage static invariants |
