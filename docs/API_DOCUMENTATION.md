# API Documentation — SHARK Investment Network

> **Phase:** Phase 4 — Backend Architecture, Database, Security & Shared Contracts
> **Status:** Active Reference (Synchronized with `supabase/functions/**`, `supabase/migrations/0007_*`, `@shark/shared-types`, and `@shark/validation`)
> **Related Specs:** [DATABASE.md](./DATABASE.md) | [SECURITY.md](./SECURITY.md) | [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)

---

## 1. API Transport & Contract Principles

1. **Standard Domain Operations:** Authenticated mobile and admin client queries execute through the typed Supabase PostgREST client (`@supabase/supabase-js`) subject to `ENABLE` + `FORCE ROW LEVEL SECURITY` on all 20 canonical `public` tables.
2. **Cursor Keyset Pagination:** List queries never perform unbounded `SELECT *` fetches. Limits are bounded (`1 <= limit <= 50`, default `20`) via `paginationQuerySchema` (`@shark/validation`) and opaque UTF-8 Base64URL cursors via `encodeCursor` / `decodeCursor` (`@shark/utils`).
3. **Localized Error Envelopes:** Every Edge Function error and normalized repository error returns a client-safe envelope without exposing raw PostgreSQL stack traces or PII:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "messageKey": "errors.forbidden",
    "requestId": "c7a9d3f4-..."
  }
}
```

4. **Response Headers:** All Edge Function responses return `Cache-Control: no-store` and explicit allowlisted CORS headers from `_shared/cors.ts` (never `*`).

---

## 2. Supabase Edge Functions (`supabase/functions/`)

All Edge Functions verify the JWT signature server-side via `authClient.auth.getUser(jwt)` against live database `profiles` and `admin_roles` state (excluding `suspended` and `deleted_at IS NOT NULL` accounts).

### 2.1 `POST /functions/v1/get-signed-document-url`

Issues short-lived signed URLs for private files inside `pitch-documents` and `verification-documents`.

- **Authorization:**
  - `verification-documents`: Document owner (`verification_requests.user_id`) OR active approved admin with `verifications:read`.
  - `pitch-documents`: Admin with `pitches:read`, active company operator (`owner_id` or active `company_members`), or approved member when document is non-restricted on an approved pitch, or holder of an active non-revoked/non-expired `pitch_access_grants` entry on restricted pitches/documents.
  - Quarantined (`scan_status = 'quarantined'`) or inactive documents return `403 DOCUMENT_QUARANTINED` / `404 NOT_FOUND`.
- **Rate Limit:** `20` requests / `60s` per `actor.userId`.
- **Request Body (`getSignedDocumentUrlSchema`):**

```json
{
  "bucket": "pitch-documents",
  "documentId": "44444444-4444-4444-8444-444444444402",
  "storagePath": "optional/override/path.pdf"
}
```

- **Response (`200 OK`, `Cache-Control: no-store`):**

```json
{
  "signedUrl": "https://.../storage/v1/object/sign/...",
  "expiresAt": "2026-11-20T00:15:00.000Z",
  "ttlSeconds": 60,
  "contentType": "application/pdf",
  "fileName": "madar-model.xlsx"
}
```

- **TTL Rules:** `60s` for all `verification-documents` and confidential/restricted `pitch-documents`; capped at `SIGNED_URL_TTL_SECONDS` (`<= 120s`) for standard pitch documents.

---

### 2.2 `POST /functions/v1/admin-user-action`

Executes privileged user moderation, lifecycle status changes, and role assignments.

- **Authorization:** Active admin triple-gate + mapped permission scope:
  - `approve`, `reject`, `reactivate` -> `users:review`
  - `suspend` -> `users:suspend`
  - `change_role`, `assign_admin_role` -> `roles:manage`
- **Self-Action Block:** Returns `403 SELF_ACTION_FORBIDDEN` if `targetUserId === actor.userId`.
- **Rate Limit:** `60` requests / `60s` per `actor.userId`.
- **Request Body (`adminUserActionSchema`):**

```json
{
  "action": "suspend",
  "targetUserId": "11111111-1111-4111-8111-111111111103",
  "reason": "Compliance review hold pending updated KYC submission."
}
```

- **Side Effects:**
  - Executes atomic RPC `public.admin_execute_user_action(...)` updating `profiles`/`admin_roles` and inserting an immutable `activity_logs` row.
  - On `suspend`, `reject`, or demotion from `admin`, invokes `auth.admin.signOut(targetUserId, 'global')` and deactivates `device_tokens`.
  - Dispatches bilingual in-app `notifications` for account lifecycle transitions.

---

### 2.3 `POST /functions/v1/admin-review-entity`

Reviews and moderates companies, KYC/KYB verification requests, investment pitches, and pitch documents.

- **Authorization:** Active admin triple-gate with entity-scoped permissions:
  - `company` (`verified`/`unverified`) -> `companies:verify`; (`approved`/`rejected`/`suspended`/`needs_info`) -> `companies:review`
  - `verification_request` (`pending`/`needs_info`/`approved`/`rejected`) -> `verifications:review`
  - `pitch` (`approved`/`rejected`/`needs_info`/`closed`) -> `pitches:review`; (`approved_restricted`/`restricted`/`unrestricted`) -> `pitches:restrict`
  - `pitch_document` (`restricted`/`unrestricted`/`disabled`) -> `documents:moderate`
- **Mandatory Audit Reason:** Decisions `rejected`, `suspended`, `restricted`, `needs_info`, and `disabled` require `reason.length >= 10`.
- **Rate Limit:** `60` requests / `60s` per `actor.userId`.
- **Side Effects:** Executes `public.admin_execute_entity_review(...)` atomically (updating entity state, inserting `pitch_reviews` when applicable, writing immutable `activity_logs`, and sending non-internal bilingual notifications to the owner).

---

### 2.4 `POST /functions/v1/send-push-notification`

Creates bilingual in-app notification records and dispatches Expo Push notifications.

- **Authorization (Dual Mode):**
  - **Admin Caller:** Active admin triple-gate with `notifications:send` (`30` requests / `3600s` rate limit).
  - **Internal Backend Caller:** Constant-time comparison of `x-internal-service-key` against `INTERNAL_EDGE_SECRET` (`>= 16` chars).
- **Request Body Modes (`sendPushNotificationEdgeSchema`):**
  - **Target-Mode Broadcast (`SendPushNotificationRequest`):**
    - `targetMode`: `'user_ids' | 'role' | 'sector' | 'all_approved'`
    - `userIds`: `1..500` UUIDs (required when `targetMode === 'user_ids'`)
    - `role`: `'investor' | 'founder' | 'member' | 'admin'` (required when `targetMode === 'role'`; resolves approved non-deleted accounts up to `500` recipients)
    - `sectorId`: sector UUID (required when `targetMode === 'sector'`; resolves approved non-deleted profiles, investors, founders, and approved company owners linked to that sector up to `500` recipients)
    - `all_approved`: resolves approved non-deleted accounts bounded to `500` recipients per invocation
  - **Direct Trigger (`SendDirectPushNotificationRequest`):**
    - `recipientIds`: `1..500` valid UUIDs (deduplicated server-side; primarily for internal lifecycle triggers targeting explicit account IDs).
  - **Shared Fields:**
    - `category`: one of `account_status`, `verification`, `company_review`, `pitch_review`, `investment_interest`, `access_grant`, `announcement`, `security`.
    - `titleAr`, `titleEn`: `1..160` trimmed characters.
    - `bodyAr`, `bodyEn`: `1..1000` trimmed characters.
    - `deepLink`: optional safe relative path matching `^/[a-zA-Z0-9/_-]*$` (prevents open redirects).
- **Response (`200 OK`, `Cache-Control: no-store`):**
  - Returns `{ success: true, requestId, targetMode, notificationsInserted, pushAttempted, tokensDeactivated }`.
- **Push Delivery Hygiene:** Selects locale-specific copy (`ar`/`en`) per `profiles.preferred_language`, sends in batches of `100` to `https://exp.host/--/api/v2/push/send`, never logs token strings, marks `DeviceNotRegistered` tokens `is_active = false`, and fails closed (`500 AUDIT_PERSISTENCE_FAILED`) if the immutable `activity_logs` write fails.

---

### 2.5 `POST /functions/v1/delete-own-account`

Allows authenticated non-admin users to permanently delete their own account after password re-authentication.

- **Authorization:** Live authenticated non-suspended user; blocks active admins (`403 ADMIN_SELF_DELETE_FORBIDDEN`) and founders who remain sole owners of active multi-member companies (`409 OWNERSHIP_TRANSFER_REQUIRED`).
- **Rate Limit:** `3` requests / `86400s` (daily) per `actor.userId`.
- **Request Body (`deleteOwnAccountSchema` contract):**

```json
{
  "currentPassword": "CurrentUserPassword1!",
  "confirmationPhrase": "DELETE"
}
```

- **Execution Sequence:**
  1. Verifies `currentPassword` via `anonClient.auth.signInWithPassword`.
  2. Deletes private storage objects in `verification-documents/<userId>/`, `public-assets/<userId>/`, and solo-company `pitch-documents`.
  3. Writes anonymized immutable audit trail entry (`account.self_deleted`, `metadata: { anonymized: true }`).
  4. Revokes global sessions and calls `auth.admin.deleteUser(actor.userId)` (preserving `activity_logs` via `ON DELETE SET NULL`).

---

## 3. Public Views & RPC Functions

| Identifier | Access | Purpose | Source |
| :--- | :--- | :--- | :--- |
| `public.public_investors_directory` | `anon`, `authenticated` | Zero-PII directory of approved public investors | `0007_rls_helpers_views_and_policies.sql` |
| `public.public_companies_directory` | `anon`, `authenticated` | Zero-PII directory of approved companies (`verification_status` badge without `registration_number`) | `0007_rls_helpers_views_and_policies.sql` |
| `public.public_portfolio_companies_directory` | `anon`, `authenticated` | Public portfolio badges linked to approved listed investors | `0007_rls_helpers_views_and_policies.sql` |
| `public.get_public_system_flags()` | `anon`, `authenticated` | Returns `maintenance_mode` and `registration_open` booleans only (`SECURITY DEFINER`) | `0007_rls_helpers_views_and_policies.sql` |
| `public.check_rate_limit(...)` | `service_role` only | Sliding-window counter backed by `private_internal.rate_limit_events` | `0007_rls_helpers_views_and_policies.sql` |
| `public.admin_update_system_setting(...)` | `service_role` / `admin` | Super-admin allowlisted config updates with mandatory `activity_logs` write | `0007_rls_helpers_views_and_policies.sql` |
| `public.admin_execute_user_action(...)` | `service_role` only | Atomic user status/role mutation + `activity_logs` insert | `0007_rls_helpers_views_and_policies.sql` |
| `public.admin_execute_entity_review(...)` | `service_role` only | Atomic company/KYC/pitch/document review + `pitch_reviews` + `activity_logs` | `0007_rls_helpers_views_and_policies.sql` |

---

## 4. Shared Validation & Contract Packages

- **`@shark/shared-types`** (`packages/shared-types/src/`): Strict TypeScript unions for all 23 database enums (`enums.ts`), domain interfaces (`auth.ts`, `profiles.ts`, `companies.ts`, `pitches.ts`, `documents.ts`, `notifications.ts`, `admin.ts`), cursor pagination types (`pagination.ts`), and Phase 3 UI tokens (`ui.ts`).
- **`@shark/validation`** (`packages/validation/src/`): Zod `.strict()` schemas emitting i18n keys (`validation.*`), HTTPS URL guards (`httpsUrlSchema`), path traversal protection (`safeStoragePathSchema`), banned MIME/extension enforcement, and environment secret boundary checks (`env.schema.ts`).
- **`@shark/utils`** (`packages/utils/src/`): Framework-independent RTL/formatting helpers, UTF-8 Base64URL keyset cursors (`pagination.ts`), and `normalizeErrorToEnvelope` (`errors.ts`).
