# Accessibility & Bilingual RTL/LTR Verification Report — Phase 3

> **Scope:** `@shark/design-tokens`, `@shark/utils`, `@shark/mobile`, and `@shark/admin`  
> **Standards:** WCAG 2.1 Level AA (Text `>= 4.5:1`, Large Text / UI Components `>= 3.0:1`, Touch Targets `>= 44×44pt/px`) · Bilingual Arabic RTL (Default) + English LTR

---

## 1. Automated WCAG 2.1 AA Contrast Matrix

Computed directly from `@shark/design-tokens` (`getContrastRatio` / `meetsWcagAA`) and verified by `tests/design-system/tokens-wcag.test.ts`:

| Audit Pair ID | Foreground | Background | Measured Ratio | Minimum Required | Verdict | Usage |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `text-main-on-white` | `#172033` | `#FFFFFF` | **16.27:1** | `4.5:1` | **PASS** | Primary text on cards, modals, and inputs |
| `text-main-on-canvas` | `#172033` | `#F7F9FC` | **15.42:1** | `4.5:1` | **PASS** | Primary text on global app canvas |
| `text-main-on-subtle` | `#172033` | `#EDF2F7` | **14.44:1** | `4.5:1` | **PASS** | Primary text on subtle chips and tracks |
| `white-on-navy` | `#FFFFFF` | `#142B49` | **14.27:1** | `4.5:1` | **PASS** | Primary button text and active Admin sidebar links |
| `navy-on-white` | `#142B49` | `#FFFFFF` | **14.27:1** | `4.5:1` | **PASS** | Secondary/Ghost button text and active mobile tab |
| `navy-on-navy-tint` | `#142B49` | `#E8EEF5` | **12.22:1** | `4.5:1` | **PASS** | Restricted badge and selected chip label |
| `text-secondary-on-white` | `#687386` | `#FFFFFF` | **4.79:1** | `4.5:1` | **PASS** | Metadata and helper text on white surface |
| `text-secondary-on-canvas` | `#687386` | `#F7F9FC` | **4.54:1** | `4.5:1` | **PASS** | Metadata on `#F7F9FC` canvas |
| `text-secondary-surface-on-subtle` | `#525D70` | `#EDF2F7` | **5.90:1** | `4.5:1` | **PASS** | Table headers, disabled text, and neutral pills on `#EDF2F7` |
| `warning-text-on-tint` | `#664400` | `#FDF5E4` | **8.09:1** | `4.5:1` | **PASS** | Pending status badges and warning banners |
| `warning-icon-on-tint` | `#8F5E06` | `#FDF5E4` | **5.13:1** | `3.0:1` | **PASS** | Warning icons on `#FDF5E4` tint |
| `success-text-on-tint` | `#0E7048` | `#E8F7F0` | **5.54:1** | `4.5:1` | **PASS** | Approved and verified badges |
| `success-icon-on-white` | `#16A36A` | `#FFFFFF` | **3.24:1** | `3.0:1` | **PASS** | Verified icons and progress indicators on white |
| `white-on-error-fill` | `#FFFFFF` | `#DC3545` | **4.53:1** | `4.5:1` | **PASS** | Danger primary button label |
| `error-text-on-tint` | `#B02230` | `#FDECEC` | **5.90:1** | `4.5:1` | **PASS** | Rejected / suspended badges and alert banners |
| `error-text-on-white` | `#B02230` | `#FFFFFF` | **6.74:1** | `4.5:1` | **PASS** | Inline form validation error text |
| `info-text-on-tint` | `#1B5A99` | `#EAF3FC` | **6.31:1** | `4.5:1` | **PASS** | Informational and under-review badges |
| `input-border-on-white` | `#808A9D` | `#FFFFFF` | **3.48:1** | `3.0:1` | **PASS** | Form input outline contrast (WCAG 1.4.11) |

In addition, all 19 `(domain, status)` combinations of `resolveStatusBadgeTokens()` are verified programmatically in `tests/design-system/tokens-wcag.test.ts` for both badge label text (`>= 4.5:1`) and badge icon (`>= 3.0:1`), ensuring non-color redundancy (`icon + label + border + tint`) on every badge.

---

## 2. Touch Target, Keyboard, Screen Reader & Motion Controls

- **Minimum Touch Targets (`>= 44×44pt/px`):**
  - Mobile: `Button` (`minHeight: 44` / `48`, `minWidth: 44`), `TextInput` (`minHeight: 48`, password toggle `44×44` + `hitSlop`), `SearchInput` (`44` height, clear/filter icons `44×44`), `Select` (`48` trigger, `44` option rows), `InvestorCard` bookmark (`44×44`), `ScreenHeader` back button (`44×44`), `BottomTabBarShell` tabs (`minHeight: 44`).
  - Admin: `min-h-[44px]` / `min-w-[44px]` enforced across `Button`, `SearchInput` clear/filter actions, `TextInput` password toggle, `SlideOverDrawer` close, `SignedDocPreviewModal` close, `DataTable` row action menu + pagination controls, `AdminShell` sidebar toggle & locale switcher.
- **Keyboard & Focus Management (Admin Web):**
  - `eslint-plugin-jsx-a11y` enforced cleanly with zero errors across `apps/admin`.
  - Visible focus ring (`focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2`) on interactive controls.
  - `ConfirmationDialog` uses `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, `Escape` dismissal (blocked while `loading`), and restores focus on close.
  - `BackdropOverlay` uses native `<button tabIndex={-1} aria-label=...>` rather than clickable `<div>` containers.
- **Reduced Motion & Loading Announcements:**
  - Mobile `LoadingSkeleton` inspects `AccessibilityInfo.isReduceMotionEnabled()` and halts animation when enabled while hiding individual bones (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`).
  - Admin `LoadingSkeleton` uses `motion-reduce:animate-none` and `globals.css` enforces `@media (prefers-reduced-motion: reduce)` globally alongside `aria-busy="true"` and `aria-live="polite"`.

---

## 3. Bilingual RTL/LTR, Typography & Formatting Verification

- **Arabic Cursive Ligatures & Script Line Heights:**
  - Tested in `tests/design-system/tokens-wcag.test.ts`: every `typeScale` token enforces `letterSpacingAr === 0`, `lineHeightAr >= lineHeightEn`, and `textTransform === 'none'` for `ar`.
- **Logical Layout Hygiene:**
  - Verified by `tests/design-system/rtl-css-hygiene.test.ts`: zero physical Tailwind classes (`ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `rounded-l-*`, `rounded-r-*`, `border-l-*`, `border-r-*`) in `apps/admin/src/**/*.tsx`, and zero physical directional style properties or raw `#RRGGBB` hex literals in `apps/mobile` `.tsx` components.
- **Gregorian Calendar & Western Digits (`0–9`):**
  - Verified by `tests/utils/rtl-and-formatters.test.ts`: all currency, raise target, ticket range, percentage, and Gregorian date formatters output Latin numerals (`0–9`) without Eastern Arabic numerals (`٠-٩`).
- **Translation Dictionary Parity:**
  - Verified by `tests/i18n/parity.test.ts`: 100% key parity across `apps/mobile/src/i18n/{ar,en}.json` and `apps/admin/src/i18n/{ar,en}.json`.
