# SHARK Investment Network

Bilingual (**Arabic default with full RTL**, English with full LTR), production-grade investment networking platform connecting investors, startup founders, companies, and ecosystem members across Mobile (`apps/mobile`), Admin Web (`apps/admin`), and Supabase (`supabase/`).

## Monorepo Structure

```text
shark-investment-network/
├── apps/
│   ├── mobile/                # @shark/mobile — Expo SDK 54 + Expo Router (Android & iOS)
│   └── admin/                 # @shark/admin — Next.js App Router + Tailwind CSS
├── packages/
│   ├── config/                # @shark/config — Shared TS, ESLint flat, and Prettier configs
│   ├── design-tokens/         # @shark/design-tokens — Brand colors, type, spacing, radii, shadows
│   ├── shared-types/          # @shark/shared-types — Canonical domain enums, entities & DTOs
│   ├── validation/            # @shark/validation — Strict Zod schemas & env validators
│   └── utils/                 # @shark/utils — RTL helpers, Intl formatters, pagination, errors
├── supabase/                  # PostgreSQL migrations, RLS, storage policies, Edge Functions, seed
├── tests/                     # @shark/tests — Cross-workspace, security, i18n parity & E2E tests
└── docs/                      # Phase 1–8 architecture, PRD, database, design system & security specs
```

## Prerequisites

- **Node.js** `>= 22.0.0`
- **pnpm** `>= 10.0.0`
- **Git** `>= 2.40`
- **Windows Path Requirement:** Keep checkout in a short ASCII path outside OneDrive (e.g., `C:\dev\shark-investment-network`) to avoid NTFS junction, Metro, and Android Gradle issues.

## Getting Started

1. **Install workspace dependencies:**
   ```bash
   pnpm install
   ```
2. **Configure environment variables (local only, never commit `.env`):**
   - Root tooling reference: copy `.env.example` to `.env`
   - Mobile app: copy `apps/mobile/.env.example` to `apps/mobile/.env.local`
   - Admin dashboard: copy `apps/admin/.env.example` to `apps/admin/.env.local`
3. **Run quality checks:**
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm format:check
   pnpm test
   ```
4. **Start applications:**
   - Mobile (Expo): `pnpm mobile`
   - Admin Web (Next.js): `pnpm admin`

## Governing Documentation

- [AGENTS.md](./AGENTS.md) — Agent roster, ownership boundaries, and mandatory engineering invariants
- [docs/PRD.md](./docs/PRD.md) — Product requirements & access-control state machines
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture, monorepo DAG & ADRs
- [docs/DATABASE.md](./docs/DATABASE.md) — Canonical PostgreSQL schema, triggers, RLS & storage design
- [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) — Corporate Navy (`#142B49`), typography & WCAG AA tokens
- [docs/SECURITY.md](./docs/SECURITY.md) — STRIDE threat model, secret hygiene & 11 security verification scenarios
- [docs/ROADMAP.md](./docs/ROADMAP.md) — Phased implementation plan (Phases 0–8)
