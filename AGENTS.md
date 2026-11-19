# AGENTS.md — SHARK Investment Network

> Governing engineering charter, agent roles, file ownership boundaries, and mandatory rules for all AI agents and contributors working on **SHARK Investment Network**.

---

## 1. Mission & Product Summary

**SHARK Investment Network** is a bilingual (Arabic default with full RTL, English with full LTR), production-grade investment networking platform connecting investors, startup founders, companies, entrepreneurs, and investment opportunities across:
- **Mobile App (`apps/mobile`)**: Android & iOS via React Native + Expo + TypeScript + Expo Router.
- **Admin Dashboard (`apps/admin`)**: Web-based administration portal via Next.js App Router + TypeScript + Tailwind CSS.
- **Backend (`supabase/`)**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security, Supabase Edge Functions).
- **Shared Packages (`packages/`)**: Monorepo pnpm workspace packages for types, Zod validation, design tokens, utilities, and configuration.

---

## 2. Specialized Agent Roster & Ownership Boundaries

To avoid conflicting file edits and maintain strict architectural boundaries, work is divided across six specialized roles. **No agent may modify files outside its assigned ownership without an explicit coordinated handoff.**

| Agent | Role Title | Primary Responsibilities | Assigned File / Folder Ownership |
| :--- | :--- | :--- | :--- |
| **Agent 1** | **Product Architect** | PRD, user journeys, system architecture, monorepo structure, ADRs, roadmap, cross-module integration planning | `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `README.md`, root `package.json`, `pnpm-workspace.yaml`, `packages/config/*` |
| **Agent 2** | **UI/UX Designer** | Design system tokens, WCAG AA contrast verification, RTL/LTR layout specifications, navigation flows, reusable UI component specs | `docs/DESIGN_SYSTEM.md`, `packages/design-tokens/*`, UI specs & locale UX review across `apps/mobile` & `apps/admin` |
| **Agent 3** | **Mobile Engineer** | Expo app, Expo Router navigation, bilingual RTL/LTR implementation, Auth flows, Discovery/Investors/Companies/Pitches/Account screens, Expo Notifications, Sentry/PostHog mobile integration | `apps/mobile/**`, `packages/utils/src/rtl*` (with Agent 2 review) |
| **Agent 4** | **Backend Engineer** | Supabase PostgreSQL schema, ERD, migrations, triggers, RLS policies, Storage buckets, Edge Functions, seed data, shared types/validation alignment | `docs/DATABASE.md`, `docs/API_DOCUMENTATION.md`, `supabase/**`, `packages/shared-types/**`, `packages/validation/**`, `packages/utils/**` |
| **Agent 5** | **Admin Engineer** | Next.js App Router admin web portal, server-side admin verification, all 13 dashboard modules, data tables, review workflows, analytics & audit log UI | `apps/admin/**` |
| **Agent 6** | **QA & Security Engineer** | Threat model, RLS verification, auth/permission boundary tests, signed URL security checks, bilingual RTL/LTR testing, CI checks, bug reports | `docs/SECURITY.md`, `docs/TESTING.md`, `tests/**`, `__tests__/**`, `supabase/tests/**` |

### Coordination Protocol
1. **Shared Packages (`packages/*`)**: Changes to `@shark/shared-types` or `@shark/validation` affecting Mobile or Admin must maintain backward compatibility or update consumers in the same reviewed task.
2. **Schema Changes (`supabase/migrations/*`)**: Only Agent 4 authors database migrations. Any schema update must simultaneously update `docs/DATABASE.md` and regenerate/update `@shark/shared-types` and `@shark/validation`.
3. **Security Gate**: Any new RLS policy, Edge Function, Storage rule, or Admin Server Action requires Agent 6 security review before merge/phase sign-off.
4. **Sequential Fallback**: When parallel subagents are unavailable, the Lead Engineer executes each role's responsibilities sequentially while preserving these exact boundaries and checklists.

---

## 3. Non-Negotiable Architectural & Security Invariants

1. **Strict Separation of Role vs. Account Status**:
   - `user_role`: `investor | founder | member | admin`
   - `account_status`: `pending | approved | rejected | suspended`
   - New registrations ALWAYS start as `pending` (`admin` cannot be selected at signup).
   - Holding a role NEVER automatically grants `approved` access.
2. **Backend-Enforced Authorization Only**:
   - All permissions MUST be enforced via PostgreSQL RLS policies, database triggers, Edge Functions, and Next.js server-side authorization.
   - Frontend route guards exist for UX only and MUST NEVER be relied upon for security.
3. **Zero Client Secret Exposure**:
   - Never expose `SUPABASE_SERVICE_ROLE_KEY` or server secrets to `apps/mobile` or browser bundles (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`).
   - Never commit `.env`, `.env.local`, or real credentials to version control.
4. **Confidential Document Isolation**:
   - Pitch decks, financial models, and identity verification files MUST reside in private Supabase Storage buckets (`pitch-documents`, `verification-documents`).
   - Access is granted solely via short-lived Signed URLs issued after server-side permission checks.
5. **Immutable Audit Trail**:
   - Every sensitive administrative action (approve/reject/suspend user, role change, company verification, pitch review, document restriction, system setting update) MUST be logged to `activity_logs`.
6. **No Firebase Replacement**:
   - Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions) is the sole backend platform.

---

## 4. Mandatory Engineering Standards

1. **TypeScript Strict Mode**: `"strict": true` across every app and package. Never use `any`; prefer `unknown` with Zod parsing or explicit discriminated unions.
2. **Clean Architecture**: Separate UI components, TanStack Query hooks / state orchestration, domain validation (`@shark/validation`), and Supabase data repositories.
3. **Boundary Validation**: Validate all form inputs, API payloads, query filters, and environment variables at system boundaries using Zod.
4. **No Hardcoded User-Facing Strings**: Every label, button, placeholder, validation message, error message, and notification must come from centralized `ar` / `en` translation dictionaries. Arabic (`ar`, RTL) is the default language.
5. **Design System Compliance**:
   - Use `@shark/design-tokens` values exclusively (`#142B49` Navy, `Inter` / `IBM Plex Sans Arabic`, 4px spacing scale, `8/12/16px` radii, `>= 44pt` touch targets, WCAG AA contrast).
   - Build reusable primitives rather than duplicating styles or component logic.
6. **Pagination & Query Discipline**:
   - Never fetch entire tables (`SELECT *` unbounded). Always project explicit columns and apply cursor/keyset or bounded pagination.
7. **No Fake Implementation**:
   - Never fake backend functionality, never show fake success messages, never leave critical user flows as placeholder screens, and never claim completion until implemented and tested.
8. **Migrations & Docs Synchronization**:
   - All database changes must be version-controlled in `supabase/migrations/`.
   - Keep `README.md` and `docs/*` synchronized with real code and configuration.

---

## 5. Phased Development Workflow

All agents follow the approved phased delivery model:
- **Phase 0**: Workspace Inspection (Complete before Phase 1).
- **Phase 1**: Architecture & Planning (`docs/*`, `AGENTS.md`) -> **Requires user approval before Phase 2**.
- **Phase 2**: Project Foundation (pnpm workspace, `apps/mobile`, `apps/admin`, `packages/*`, configs, Supabase setup).
- **Phase 3**: Design System (tokens, reusable components, typography, RTL/LTR, responsive layout).
- **Phase 4**: Backend (migrations, core & supporting tables, Auth triggers, RLS, Storage, Edge Functions, seed data, RLS tests).
- **Phase 5**: Mobile Application (Auth flow first, then Discovery, Investors, Companies, Pitches, Account).
- **Phase 6**: Admin Dashboard (Admin Auth & RBAC first, then all 13 modules).
- **Phase 7**: End-to-End Integration (Mobile + Admin + Supabase full user journeys).
- **Phase 8**: QA, Security Verification & Release Preparation (tests, bilingual/RTL validation, security checks, build & deployment readiness).

---

## 6. Definition of Done (Per Task / Phase)

Before marking any task complete, the owning agent must verify:
- [ ] `pnpm typecheck` passes with zero errors (from Phase 2 onward).
- [ ] `pnpm lint` passes with zero errors/warnings on touched files.
- [ ] All user-facing strings exist in both `ar` and `en` translation files and render cleanly in RTL and LTR.
- [ ] New or modified backend policies/endpoints pass automated tests (never UI-only tests for access control).
- [ ] No secrets, debug tokens, or `any` types exist in the diff.
- [ ] Only real observed outputs and verified file paths are reported.
