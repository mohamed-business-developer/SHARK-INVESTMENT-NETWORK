# Component Library & Usage Examples — SHARK Investment Network

> **Phase 3 Deliverable** | **Companion Specs:** [docs/DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [docs/ACCESSIBILITY_REPORT.md](./ACCESSIBILITY_REPORT.md)

---

## 1. Shared Packages

### 1.1 `@shark/design-tokens`
Framework-agnostic design system tokens consumed by both `apps/mobile` and `apps/admin`:

- **Colors & WCAG Verification:** `rawPalette`, `lightSemanticColors`, `darkSemanticColors`, `getSemanticColors(mode)`, `resolveStatusBadgeTokens(domain, status)`, `getContrastRatio(fg, bg)`, `meetsWcagAA(fg, bg, kind)`.
- **Typography (`Inter` & `IBM Plex Sans Arabic`):** `fontFamilies`, `typeScale` (`display`, `h1`–`h4`, `bodyLg`, `bodyBase`, `bodySm`, `caption`, `overline`, `metricLg`, `metricMd`), `resolveTypography(token, locale, weightOverride)`.
- **Spatial & Elevation:** `space` (`4px` grid), `layoutTokens` (`touchTargetMin: 44`), `radii` (`none: 0`, `sm: 8`, `md: 12`, `lg: 16`, `pill: 9999`), `shadows` (`none`, `xs`, `sm`, `md`, `modal`).

```ts
import { resolveStatusBadgeTokens, resolveTypography } from '@shark/design-tokens';

const titleType = resolveTypography('h2', 'ar');
// { fontSize: 20, lineHeight: 34, letterSpacing: 0, mobileFontFamily: 'IBMPlexSansArabic_600SemiBold', ... }

const verifiedBadge = resolveStatusBadgeTokens('verification', 'verified');
// { background: '#E8F7F0', border: '#A3DFC3', text: '#0E7048', iconColor: '#0E7048', icon: 'shield-check' }
```

### 1.2 `@shark/utils`
Pure RTL/LTR directional helpers, Gregorian + Western-digit formatters, and localization persistence adapters:

```ts
import {
  formatCompactRaise,
  formatDate,
  formatTicketRange,
  isolateLtrValue,
  shouldMirrorIcon,
} from '@shark/utils';

formatCompactRaise(2_500_000, 'ar'); // "2.5 مليون USD"
formatTicketRange(250_000, 1_000_000, 'en'); // "$250K – $1M"
formatDate('2026-11-19T14:30:00Z', 'ar'); // Gregorian month + Latin digits (0–9)
shouldMirrorIcon('arrow-back', 'ar'); // true
shouldMirrorIcon('shield', 'ar'); // false
isolateLtrValue('+966501234567'); // "\u2066+966501234567\u2069"
```

---

## 2. Mobile Component Library (`apps/mobile/src/components/`)

| Component | Import Path | Purpose & Key Guarantees |
| :--- | :--- | :--- |
| `AppText` | `@/components/ui` | Resolves `Inter` / `IBM Plex Sans Arabic`, Arabic `letterSpacing: 0`, `includeFontPadding: false`, `tabular-nums`, and BiDi `writingDirection`. |
| `Button` | `@/components/ui` | `primary`, `secondary`, `ghost`, `danger`; `md` (`44px`) & `lg` (`48px`); loading spinner preserves layout; auto-mirrored directional icons. |
| `TextInput` | `@/components/ui` | `48px` height, `#808A9D` `1px` border (`>= 3.0:1`), `forceLtrValue` for emails/phones/OTPs, `44×44` password visibility toggle, `#B02230` error state. |
| `SearchInput` | `@/components/ui` | `44px` height, start search icon, `44×44` clear `×` button, optional filter count badge trigger. |
| `Select` | `@/components/ui` | `48px` trigger opening an accessible modal bottom sheet (`radius.lg` top corners) with `>= 44pt` rows. |
| `Card` | `@/components/ui` | `#FFFFFF` surface, `1px solid #E2E8F0`, `radius.md` (`12px`), optional interactive press tint. |
| `StatusBadge` | `@/components/ui` | Icon + label pairing across `account`, `company`, `verification`, and `pitch` statuses using `resolveStatusBadgeTokens`. |
| `ProfileHeader` | `@/components/ui` | `64px` avatar/initials, up to 2 `StatusBadge` pills, RTL-aware completeness bar, `surface` or `navy` variant. |
| `FeedbackBanner` & `useToast` | `@/components/ui` | Inline `info`/`success`/`warning`/`error` alerts and floating toasts (`4s` auto-dismiss for `info`/`success`). |
| `EmptyState` & `LoadingSkeleton` | `@/components/ui` | `no_data`, `no_search_results`, `restricted`, `error` states; reduced-motion-aware `LoadingSkeleton`. |
| `ConfirmationDialog` | `@/components/ui` | `standard` / `destructive` confirmation modal with optional `requireReasonInput` (`>= 10` chars enforced). |
| `InvestorCard`, `CompanyCard`, `PitchCard` | `@/components/cards` | Canonical directory & deal cards implementing `full` and `restricted_locked` states (zero confidential data rendered when locked). |
| `ScreenHeader`, `BottomTabBarShell`, `AccessGateModal` | `@/components/navigation` | `56px` safe-area header with mirrored back arrow, 5-tab RTL/LTR shell bar, and Guest/Pending access gate modal. |

### Mobile Usage Example

```tsx
import { InvestorCard } from '@/components/cards';
import { Button, StatusBadge } from '@/components/ui';
import { useLocale } from '@/i18n';
import { formatTicketRange } from '@shark/utils';

export function SampleMobileUsage() {
  const { locale, t, toggleLocale } = useLocale();

  return (
    <>
      <Button variant="secondary" label={t.common.switchLanguage} onPress={() => void toggleLocale()} />
      <StatusBadge domain="account" status="approved" label={t.status.approved} />
      <InvestorCard
        investor={{
          id: 'inv-1',
          fullName: t.showcase.samples.profileName,
          headline: t.showcase.samples.investorHeadline,
          investorTypeLabel: t.showcase.samples.investorType,
          isVerified: true,
          verifiedLabel: t.status.verified,
          ticketRangeDisplay: formatTicketRange(250_000, 1_000_000, locale),
          ticketLabel: t.showcase.samples.ticketLabel,
          sectors: [t.showcase.samples.sectorFintech],
          countryLabel: t.showcase.samples.countryKsa,
          isSaved: false,
        }}
        onPress={() => undefined}
      />
    </>
  );
}
```

---

## 3. Admin Web Component Library (`apps/admin/src/components/`)

All Admin components use logical CSS classes exclusively (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `rtl:scale-x-[-1]`).

| Component | Import Path | Purpose & Key Guarantees |
| :--- | :--- | :--- |
| `Button`, `TextInput`, `SearchInput`, `Select`, `Card`, `StatusBadge`, `ProfileHeader` | `@/components/ui` | Web-native controls using `@shark/design-tokens` Tailwind theme, `min-h-[44px]` targets, and `focus-visible` `#2878C7` rings. |
| `FeedbackBanner` & `ToastProvider` | `@/components/ui` | `role="alert"` banners and `aria-live="polite"` toast stack. |
| `EmptyState` & `LoadingSkeleton` | `@/components/ui` | `prefers-reduced-motion` compliant skeleton loaders and guided empty/error/restricted states. |
| `ConfirmationDialog` | `@/components/ui` | `role="alertdialog"`, `aria-modal="true"`, Escape dismissal, focus restoration, and optional `>= 10`-character audit reason. |
| `SlideOverDrawer` | `@/components/ui` | Logical `end`-anchored (`480px`) inspection drawer with sticky header/footer and `44×44` close button. |
| `SignedDocPreviewModal` | `@/components/ui` | Confidential preview frame with monitoring notice and expired Signed URL recovery state. |
| `FilterBar` & `DataTable` | `@/components/ui` | `#EDF2F7` `44px` header (`#525D70`), `min-h-[56px]` rows, `tabular-nums`, `44×44` row actions, `20 | 50` pagination. |
| `InvestorCard`, `CompanyCard`, `PitchCard` | `@/components/cards` | Bilingual domain cards sharing `@shark/shared-types` contracts with Mobile. |
| `AdminShell` | `@/components/navigation` | Responsive Primary Navy (`#142B49`) sidebar (`260px` / `72px` collapsed / mobile drawer) + `64px` top bar with live `ar`/`en` cookie switcher. |

Interactive showcases for all components are mounted at:
- Mobile: [apps/mobile/app/index.tsx](file:///c:/DEV/shark-investment-network/apps/mobile/app/index.tsx)
- Admin: [apps/admin/src/components/showcase/DesignSystemShowcase.tsx](file:///c:/DEV/shark-investment-network/apps/admin/src/components/showcase/DesignSystemShowcase.tsx) (`/` and `/design-system`)
