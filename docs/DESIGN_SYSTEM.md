# SHARK Investment Network — Design System & UX Specification

> **Document Owner**: Agent 2 (Senior UI/UX Designer)  
> **Target Consumers**: `packages/design-tokens`, `apps/mobile` (React Native / Expo), `apps/admin` (Next.js / Tailwind CSS), QA & Security (`docs/TESTING.md`)  
> **Status**: Phase 1 Canonical Specification (Light Mode Default, Future Dark Mode Ready, Arabic RTL Default + English LTR)

---

## 1. Design Philosophy & Brand Direction

### 1.1 Aesthetic Positioning: Corporate Investment
**SHARK Investment Network** serves high-trust financial actors—accredited investors, startup founders, corporate executives, and compliance reviewers. Every visual decision must communicate **institutional credibility, clarity, and security**:

- **Trust & Authority**: Anchored by deep Primary Navy (`#142B49`), generous whitespace (`#FFFFFF` cards over `#F7F9FC` canvas), and crisp `1px` borders (`#E2E8F0`) rather than heavy drop shadows or decorative gradients.
- **Data Precision**: Financial metrics, ticket sizes, valuations, and timestamps use tabular lining numerals (`tabular-nums`) and Western Arabic digits (`0–9`) across both Arabic and English locales to avoid ambiguity.
- **Calm Status Hierarchy**: Verification, approval, and document confidentiality states are immediately legible through a combination of **icon + concise label + WCAG AA tint surface**—never color alone.
- **Native Bilingual Parity**: Arabic (`ar`, RTL) is the primary default experience and is designed natively from the ground up, not as a mirrored afterthought of English (`en`, LTR).

### 1.2 Theme Architecture: Light Mode First, Dark Mode Ready
Version 1 launches exclusively in **Light Mode** (`colorScheme: 'light'`), optimized for financial document legibility and daylight mobile usage. However, **all components MUST consume semantic tokens** (e.g., `bg.canvas`, `surface.card`, `text.primary`, `border.subtle`) rather than raw hex constants so a future **Dark Mode** (`colorScheme: 'dark'`) can be enabled by swapping the semantic mapping layer in `@shark/design-tokens` without modifying UI components.

---

## 2. Color System & WCAG 2.1 AA Contrast Audit

### 2.1 Canonical Brand & Status Palette (Raw Tokens)

| Token Name | Hex | Role & Canonical Usage |
| :--- | :--- | :--- |
| `brand.navy` | `#142B49` | Primary brand identity, primary CTA fills, active tab/nav indicators, high-trust headers |
| `brand.navyHover` | `#0F2138` | Hover / focus-fill state on primary interactive controls (Web & desktop) |
| `brand.navyPressed` | `#0A1728` | Pressed / active state on primary buttons and list actions |
| `brand.navyMuted` | `#1E3F6B` | Secondary navy accents, active sidebar pill background on dark navy rails |
| `brand.navyTint` | `#E8EEF5` | Active navigation pill tint on light surfaces, selected chip fill, icon badges |
| `neutral.white` | `#FFFFFF` | Card surfaces, modal containers, text inputs, text over Primary Navy |
| `neutral.lightSurface` | `#EDF2F7` | Secondary/nested surfaces, skeleton base, segmented control track, table header fill |
| `neutral.background` | `#F7F9FC` | Global app & dashboard canvas background |
| `neutral.textMain` | `#172033` | Primary headings, body copy, financial figures, form input values |
| `neutral.textSecondary` | `#687386` | Canonical secondary text on `#FFFFFF` and `#F7F9FC` (subtitles, metadata, captions) |
| `neutral.textSecondarySurface` | `#525D70` | Accessible secondary text when placed over `#EDF2F7` Light Surface (`5.90:1`) |
| `neutral.border` | `#E2E8F0` | Card hairlines, table dividers, layout separators (decorative structural borders) |
| `neutral.borderInput` | `#808A9D` | Interactive form input outlines & radio/checkbox borders (`>= 3.0:1` WCAG 1.4.11) |
| `status.success` | `#16A36A` | Canonical success indicator dot, progress fill, verified check icon, positive chart series |
| `status.successText` | `#0E7048` | Accessible success text & solid badge fill (`>= 5.54:1` on tint, `6.12:1` with white text) |
| `status.successTint` | `#E8F7F0` | Soft background surface for Approved / Verified badges and success banners |
| `status.successBorder` | `#A3DFC3` | Border outline for Success status badges and alert banners |
| `status.warning` | `#D99A26` | Canonical warning accent bar, dark-navy-backed warning highlight, chart series |
| `status.warningText` | `#664400` | Accessible dark amber text on `#FDF5E4` / `#FFFFFF` / `#F7F9FC` (`>= 8.09:1`) |
| `status.warningIcon` | `#8F5E06` | Accessible warning icon on `#FDF5E4` / `#FFFFFF` / `#F7F9FC` (`>= 5.13:1`) |
| `status.warningTint` | `#FDF5E4` | Soft background surface for Pending Review / Attention badges and banners |
| `status.warningBorder` | `#F2D291` | Border outline for Warning status badges and alert banners |
| `status.error` | `#DC3545` | Canonical destructive button fill (with `#FFFFFF` text), error borders on white cards |
| `status.errorText` | `#B02230` | Accessible error text on `#FDECEC` / `#F7F9FC` / `#FFFFFF` (`>= 5.90:1`) |
| `status.errorTint` | `#FDECEC` | Soft background surface for Rejected / Suspended / Restricted badges and banners |
| `status.errorBorder` | `#F5B5BC` | Border outline for Error status badges and alert banners |
| `status.info` | `#2878C7` | Canonical info fill (with `#FFFFFF` text), keyboard focus rings, links on white |
| `status.infoText` | `#1B5A99` | Accessible info text on `#EAF3FC` / `#F7F9FC` / `#FFFFFF` (`>= 6.31:1`) |
| `status.infoTint` | `#EAF3FC` | Soft background surface for Informational / Under Review badges and callouts |
| `status.infoBorder` | `#A9CEF2` | Border outline for Info status badges and alert banners |

### 2.2 Semantic Token Structure (Light Mode + Future Dark Mode Mapping)

Components reference **only semantic tokens** from `@shark/design-tokens`:

| Semantic Token | Light Mode Value (`v1`) | Future Dark Mode Mapping (`v2` Ready) |
| :--- | :--- | :--- |
| `bg.canvas` | `#F7F9FC` | `#0B1320` |
| `bg.surface` | `#FFFFFF` | `#121E31` |
| `bg.surfaceElevated` | `#FFFFFF` | `#18273F` |
| `bg.surfaceSubtle` | `#EDF2F7` | `#1E2F4A` |
| `bg.overlay` | `rgba(20, 43, 73, 0.56)` | `rgba(5, 10, 18, 0.72)` |
| `text.primary` | `#172033` | `#F1F5F9` |
| `text.secondary` | `#687386` | `#A3B1C6` |
| `text.secondaryOnSubtle` | `#525D70` | `#CBD5E1` |
| `text.inverse` | `#FFFFFF` | `#FFFFFF` |
| `text.brand` | `#142B49` | `#93C5FD` |
| `border.subtle` | `#E2E8F0` | `#243652` |
| `border.interactive` | `#808A9D` | `#64748B` |
| `border.focus` | `#2878C7` | `#60A5FA` |
| `interactive.primary` | `#142B49` | `#2878C7` |
| `interactive.primaryHover` | `#0F2138` | `#3B82F6` |
| `interactive.primaryPressed` | `#0A1728` | `#1D4ED8` |
| `interactive.primaryTint` | `#E8EEF5` | `rgba(40, 120, 199, 0.18)` |
| `status.success.*` | `#16A36A` / `#0E7048` / `#E8F7F0` | `#34D399` / `#6EE7B7` / `rgba(22, 163, 106, 0.16)` |
| `status.warning.*` | `#D99A26` / `#664400` / `#FDF5E4` | `#FBBF24` / `#FDE68A` / `rgba(217, 154, 38, 0.16)` |
| `status.error.*` | `#DC3545` / `#B02230` / `#FDECEC` | `#F87171` / `#FCA5A5` / `rgba(220, 53, 69, 0.16)` |
| `status.info.*` | `#2878C7` / `#1B5A99` / `#EAF3FC` | `#60A5FA` / `#93C5FD` / `rgba(40, 120, 199, 0.16)` |

### 2.3 WCAG 2.1 AA Contrast Audit & Mandatory Accessibility Rules

All pairings below were mathematically verified against WCAG 2.1 relative luminance thresholds:
- **Normal Text** (`< 18pt` regular or `< 14pt` bold): minimum **4.5:1** (`AA`), target **7.0:1** (`AAA`).
- **Large Text** (`>= 18pt` / `24px` regular or `>= 14pt` / `18.67px` bold): minimum **3.0:1**.
- **Non-Text UI Components & Graphics** (input outlines, icons, focus rings, progress tracks): minimum **3.0:1** (WCAG 1.4.11).

| Foreground | Background | Calculated Ratio | WCAG 2.1 Status | Engineering Verdict & Rule |
| :--- | :--- | :--- | :--- | :--- |
| `#172033` (Main Text) | `#FFFFFF` (White) | **16.27:1** | AAA (Pass) | Default primary copy on cards, tables, modals, inputs |
| `#172033` (Main Text) | `#F7F9FC` (Background) | **15.42:1** | AAA (Pass) | Page titles and body text directly on app canvas |
| `#172033` (Main Text) | `#EDF2F7` (Light Surface) | **14.44:1** | AAA (Pass) | Table header labels, segmented active text, chip text |
| `#FFFFFF` (White) | `#142B49` (Primary Navy) | **14.27:1** | AAA (Pass) | Primary buttons, active Admin sidebar headers, navy banners |
| `#142B49` (Primary Navy) | `#FFFFFF` / `#F7F9FC` | **14.27:1** / **13.53:1** | AAA (Pass) | Secondary button text, brand headings, active mobile tab text |
| `#142B49` (Primary Navy) | `#E8EEF5` (Navy Tint) | **12.22:1** | AAA (Pass) | Selected navigation item, selected filter chip, icon container |
| `#687386` (Secondary Text) | `#FFFFFF` (White) | **4.79:1** | AA (Pass) | Approved for metadata, subtitles, helper text on White |
| `#687386` (Secondary Text) | `#F7F9FC` (Background) | **4.54:1** | AA (Pass) | Passes AA on `#F7F9FC`; keep font size `>= 13px` (do not lighten) |
| `#687386` (Secondary Text) | `#EDF2F7` (Light Surface) | **4.25:1** | **FAIL (Normal Text)** | **PROHIBITED** for normal text on `#EDF2F7`. Use `#525D70` instead |
| `#525D70` (Sec. Text Surface) | `#EDF2F7` (Light Surface) | **5.90:1** | AA (Pass) | **REQUIRED** for small text/labels inside `#EDF2F7` pills, table headers, tracks |
| `#FFFFFF` (White) | `#D99A26` (Warning) | **2.44:1** | **FAIL (All Levels)** | **STRICTLY PROHIBITED.** Never place white text on `#D99A26` |
| `#D99A26` (Warning) | `#FFFFFF` (White) | **2.44:1** | **FAIL (All Levels)** | **STRICTLY PROHIBITED** for text or sole UI icons on white surfaces |
| `#664400` (Warning Text) | `#FDF5E4` (Warning Tint) | **8.09:1** | AAA (Pass) | **REQUIRED** pairing for Warning/Pending badges and alert banners |
| `#172033` (Main Text) | `#D99A26` (Warning) | **6.66:1** | AA (Pass) | Permitted if a solid amber pill is ever required (prefer soft tint) |
| `#D99A26` (Warning) | `#142B49` (Primary Navy) | **5.84:1** | AA (Pass) | Permitted for amber highlight text/icons inside dark navy headers |
| `#8F5E06` (Warning Icon) | `#FDF5E4` / `#FFFFFF` | **5.13:1** / **5.57:1** | AA (Pass) | **REQUIRED** for warning icons on light backgrounds |
| `#FFFFFF` (White) | `#16A36A` (Success) | **3.24:1** | **FAIL (Normal Text)** | **PROHIBITED** for small/normal white text on `#16A36A` badges/buttons |
| `#16A36A` (Success) | `#FFFFFF` / `#F7F9FC` | **3.24:1** / **3.07:1** | UI Only (`>= 3.0:1`) | Approved for icons, status dots, progress bars, chart strokes; **NOT** small text |
| `#0E7048` (Success Text) | `#E8F7F0` (Success Tint) | **5.54:1** | AA (Pass) | **REQUIRED** pairing for Approved / Verified badges and success banners |
| `#FFFFFF` (White) | `#0E7048` (Success Text) | **6.12:1** | AA (Pass) | Required when rendering solid-fill green confirmation buttons/pills |
| `#FFFFFF` (White) | `#DC3545` (Error) | **4.53:1** | AA (Pass) | Approved for solid Destructive primary buttons (`Reject` / `Delete`) |
| `#DC3545` (Error) | `#FFFFFF` / `#F7F9FC` | **4.53:1** / **4.29:1** | AA on White / **Fail on Bg** | On `#F7F9FC` or `#FDECEC`, use `#B02230` (`6.39:1` / `5.90:1`) |
| `#B02230` (Error Text) | `#FDECEC` (Error Tint) | **5.90:1** | AA (Pass) | **REQUIRED** for Rejected / Suspended badges, alert text, error helpers |
| `#FFFFFF` (White) | `#2878C7` (Info) | **4.56:1** | AA (Pass) | Approved for solid Info action pills and focus rings (`4.56:1` on White) |
| `#1B5A99` (Info Text) | `#EAF3FC` / `#F7F9FC` | **6.31:1** / **6.71:1** | AA (Pass) | **REQUIRED** for Info badges, links on `#F7F9FC`, and callout copy |
| `#808A9D` (Border Input) | `#FFFFFF` / `#F7F9FC` | **3.48:1** / **3.30:1** | UI Pass (`>= 3.0:1`) | **REQUIRED** for form input outlines, checkbox/radio borders (note `#E2E8F0` is `1.23:1`, decorative only) |

> **Non-Color Redundancy Mandate**: No user status, verification result, pitch decision, or form validation error may rely on color alone. Every semantic state MUST render at least two cues: `(1) Icon + Label` or `(2) Border + Label + Tint`.

---

## 3. Typography System (`Inter` & `IBM Plex Sans Arabic`)

### 3.1 Font Families & Loading Strategy

| Locale | Primary Font Family | Fallback Stack | Platforms |
| :--- | :--- | :--- | :--- |
| **Arabic (`ar`, Default)** | `IBM Plex Sans Arabic` | `'IBM Plex Sans Arabic', 'Tahoma', 'Arial', sans-serif` | Mobile: `@expo-google-fonts/ibm-plex-sans-arabic` (`expo-font`)<br>Admin: `next/font/google` (`IBM_Plex_Sans_Arabic`, subsets `['arabic', 'latin']`) |
| **English (`en`)** | `Inter` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Mobile: `@expo-google-fonts/inter` (`expo-font`)<br>Admin: `next/font/google` (`Inter`, subsets `['latin']`) |
| **Monospace (IDs / Audit JSON)** | `JetBrains Mono` / System Mono | `ui-monospace, SFMono-Regular, Menlo, monospace` | Admin audit logs, reference codes, API/document checksums |

**Weights Loaded**: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold).

### 3.2 Script-Specific Line-Height & Clipping Rules (Critical for Arabic)

Arabic glyphs contain tall ascenders (e.g., `أ`, `ل`, `ط`), deep descenders (e.g., `ي`, `ر`, `و`), and stacked diacritics/harakat that clip vertically if compressed to tight Latin line-heights.

1. **Dual Line-Height Tokens**: Every typographic token specifies separate `lineHeightEn` (~`1.30–1.50` ratio) and `lineHeightAr` (~`1.50–1.75` ratio) values.
2. **Zero Negative Letter-Spacing in Arabic**: Arabic is a cursive connecting script. Applying negative `letterSpacing` (e.g., `-0.02em`) breaks ligatures and causes visual artifacts. Enforce `letterSpacing: 0` whenever `locale === 'ar'`.
3. **No Uppercase Transform in Arabic**: Arabic has no uppercase form. `textTransform: 'uppercase'` MUST only apply when `locale === 'en'` (`overline` token).
4. **Android React Native Font Padding**: Set `includeFontPadding: false` on `Text` primitives where vertical centering inside `44pt` buttons or `24px` status pills is required, paired with adequate line-height (`>= 1.45x` fontSize for Arabic) so ascenders/descenders never touch container edges.
5. **Tabular Financial Numerals**: Apply `fontVariant: ['tabular-nums']` (React Native) and `font-variant-numeric: tabular-nums` (CSS `tabular-nums`) to all monetary targets, equity percentages, counts, dates, and table columns.

### 3.3 Complete Type Scale

| Scale Token | Font Size | Weight | Line Height (`en` / `ar`) | Letter Spacing (`en` / `ar`) | Primary Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | `32px` | `700` (Bold) | `40px` (`1.25`) / `48px` (`1.50`) | `-0.02em` / `0` | Welcome Hero, Admin major splash totals |
| `h1` | `24px` | `700` (Bold) | `32px` (`1.33`) / `38px` (`1.58`) | `-0.015em` / `0` | Screen / Page main titles |
| `h2` | `20px` | `600` (SemiBold) | `28px` (`1.40`) / `34px` (`1.70`) | `-0.01em` / `0` | Section headers, Detail screen headers, Modal titles |
| `h3` | `18px` | `600` (SemiBold) | `26px` (`1.44`) / `30px` (`1.67`) | `-0.005em` / `0` | Card group headings, Drawer titles |
| `h4` | `16px` | `600` (SemiBold) | `24px` (`1.50`) / `28px` (`1.75`) | `0` / `0` | Card titles (Investor/Company/Pitch names), Form section titles |
| `bodyLg` | `16px` | `400` (Regular) | `24px` (`1.50`) / `28px` (`1.75`) | `0` / `0` | Primary Mobile readable paragraphs, pitch executive summaries |
| `bodyBase` | `14px` | `400` (Regular) | `22px` (`1.57`) / `24px` (`1.71`) | `0` / `0` | Default body copy, form inputs, Admin table cells, button labels (`500`/`600`) |
| `bodySm` | `13px` | `400`–`500` | `20px` (`1.54`) / `22px` (`1.69`) | `0` / `0` | Card metadata, helper text, filter chip labels, mobile captions |
| `caption` | `12px` | `500` (Medium) | `16px` (`1.33`) / `20px` (`1.67`) | `0` / `0` | Timestamps, status badge labels, mobile tab labels, validation hints |
| `overline` | `11px` | `600` (SemiBold) | `16px` (`1.45`) / `18px` (`1.64`) | `+0.06em` (`uppercase`) / `0` (normal) | Section eyebrow tags, KPI card sub-labels, Admin sidebar group labels |
| `metricLg` | `28px` | `700` (Bold) | `34px` (`1.21`) / `38px` (`1.36`) | `-0.01em` / `0` | Admin KPI primary figure, Pitch target raise hero (`tabular-nums`) |
| `metricMd` | `18px` | `700` (Bold) | `24px` (`1.33`) / `28px` (`1.55`) | `0` / `0` | Card key financials (Ticket range, Valuation, Equity %, `tabular-nums`) |

### 3.4 Token Export Structure (`@shark/design-tokens` Mapping)

```ts
// Conceptual contract in packages/design-tokens/src/typography.ts
export const fontFamilies = {
  en: {
    regular: 'Inter_400Regular',     // Web: var(--font-inter)
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  ar: {
    regular: 'IBMPlexSansArabic_400Regular', // Web: var(--font-ibm-plex-arabic)
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
} as const;
```

- **Admin Tailwind Integration**: `html[lang="ar"]` sets `font-family: var(--font-ibm-plex-arabic), sans-serif` and `dir="rtl"`; `html[lang="en"]` sets `font-family: var(--font-inter), sans-serif` and `dir="ltr"`. Tailwind utility classes like `text-h1`, `text-body-base`, `leading-ar-body` or CSS variables `--lh-body` switch automatically on `[dir="rtl"]` vs `[dir="ltr"]`.
- **Mobile React Native Integration**: A shared `useTypography(token)` helper resolves `{ fontFamily, fontSize, lineHeight, letterSpacing }` dynamically from the active locale (`ar` vs `en`).

---

## 4. Spacing, Radii, Elevation & Layout Grid

### 4.1 4px Base Spacing System

All padding, margin, gap, and layout rhythm values MUST derive exclusively from the **4px spatial grid**:

| Token | Value | Primary Usage |
| :--- | :--- | :--- |
| `space.0` | `0px` | Reset / flush borders |
| `space.1` | `4px` | Micro gap between icon & badge text, label-to-required asterisk, stacked compact chips |
| `space.2` | `8px` | Inline chip gap, icon-to-button label gap, tight stack spacing, table cell vertical padding |
| `space.3` | `12px` | Form label-to-input-helper group gap, mobile card internal item gap, compact list gap |
| `space.4` | `16px` | **Standard Mobile screen horizontal padding**, card internal padding (compact), input horizontal padding |
| `space.5` | `20px` | Standard Mobile card padding, dialog internal spacing, modal header padding |
| `space.6` | `24px` | **Standard Admin page horizontal/vertical gutter**, Desktop card padding, section gaps |
| `space.8` | `32px` | Major vertical section separation, Auth header spacing, Empty state vertical padding |
| `space.10` | `40px` | Auth Hero vertical rhythm, Admin KPI row separation |
| `space.12` | `48px` | Empty state illustration container padding, large layout breaks |
| `space.16` | `64px` | Top bar height (`apps/admin`), desktop hero breathing room |

### 4.2 Border Radius Tokens

| Token | Value | Applied Components |
| :--- | :--- | :--- |
| `radius.none` | `0px` | Full-bleed table rows, structural dividers |
| `radius.sm` | `8px` | Buttons (`Primary`, `Secondary`, `Danger`), Text Inputs, Search Inputs, Dropdown menus, Filter chips, Tooltips, Compact alerts |
| `radius.md` | `12px` | Standard Cards (`InvestorCard`, `CompanyCard`, `PitchCard`, KPI cards), Admin Data Table outer frame, Toast notifications |
| `radius.lg` | `16px` | Confirmation Dialogs, Modal sheets, Mobile Bottom Sheets (top corners), Onboarding Hero banners, Restricted Pitch Preview boxes |
| `radius.pill` | `9999px` | `StatusBadge`, Sector tags, Avatar circles, Notification count badges, Segmented toggle thumbs |

### 4.3 Elevation & Borders (Corporate Minimal Depth)

Because crisp borders preserve clarity across high-density financial cards better than heavy shadows:
- **`elevation.none`**: `shadow: none` + `1px solid #E2E8F0` (Default cards, table frames).
- **`elevation.xs`**: Web `0 1px 2px rgba(20, 43, 73, 0.04)` / RN `elevation: 1` (Interactive cards on canvas, subtle buttons).
- **`elevation.sm`**: Web `0 4px 12px rgba(20, 43, 73, 0.07)` / RN `elevation: 3` (Dropdown menus, hovered desktop cards, sticky headers).
- **`elevation.md`**: Web `0 10px 24px rgba(20, 43, 73, 0.12)` / RN `elevation: 6` (Toasts, floating action panels, slide-over drawers).
- **`elevation.modal`**: Web `0 20px 40px rgba(20, 43, 73, 0.18)` / RN `elevation: 12` (Confirmation dialogs, modal sheets).

### 4.4 Touch Target & Density Rules (WCAG 2.5.5)

- **Minimum Interactive Target Size**: Every tappable element on Mobile (`apps/mobile`) and Admin (`apps/admin`) MUST be at least **`44pt × 44pt`** (`44px × 44px`).
- **Compact Visual Controls**: If an icon (e.g., bookmark icon, clear search `×`, eye toggle) is visually `20px × 20px` or `24px × 24px`, its clickable button frame MUST pad to `44px × 44px` or apply `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` on React Native.
- **Spacing Between Adjacent Targets**: Minimum **`8px`** (`space.2`) gap between sibling buttons, chips, or action icons to prevent mis-taps.

### 4.5 Platform Layout Grids

- **Mobile (`apps/mobile`)**:
  - Viewport: `360px` to `430px` phones (plus adaptive `maxWidth: 600px` centered container on iPad/tablets).
  - Horizontal screen margin: `16px` (`space.4`), Safe Area aware (`react-native-safe-area-context`).
  - Tab Bar height: `60px` + bottom safe area inset (`env(safe-area-inset-bottom)`).
  - Header height: `56px` + top safe area inset.
- **Admin Dashboard (`apps/admin`)**:
  - Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`.
  - Sidebar Width: `260px` expanded (`>= 1024px`), `72px` icon-rail collapsed mode, overlay drawer (`< 1024px`).
  - Sticky Top Bar Height: `64px` (`space.16`).
  - Workspace Max Container: `1440px` centered within main pane, `24px` (`space.6`) padding (`16px` on `< 768px`).

---

## 5. Multilingual RTL/LTR Architecture (Arabic Default + English Toggle)

### 5.1 Locale Policy
- **Default Locale**: Arabic (`ar`), `dir="rtl"`.
- **Secondary Locale**: English (`en`), `dir="ltr"`.
- **Zero Hardcoded Strings**: All labels, placeholders, error states, statuses, tooltips, and notifications come from centralized typed translation dictionaries (`ar` and `en`).
- **Immediate Language Accessibility**: Users can switch language (`العربية / English`) directly from the **Welcome** screen before login, inside the **Account** tab (Mobile), and in the **Top Utility Bar** (Admin).

### 5.2 Technical Implementation Rules

#### Admin Web (`apps/admin` — Next.js + Tailwind CSS)
- Set `lang="ar" dir="rtl"` or `lang="en" dir="ltr"` dynamically on the root `<html>` element (with zero hydration flash by reading user preference cookie/header in the Root Server Layout).
- **Mandatory Logical CSS Classes ONLY**:
  - Use `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `rounded-s-*`, `rounded-e-*`, `border-s-*`, `border-e-*`.
  - **BANNED** physical utilities: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `rounded-l-*`, `rounded-r-*`, `border-l-*`, `border-r-*` (enforce via ESLint/code review unless explicitly annotated `/* ltr-only: phone/otp */`).

#### Mobile (`apps/mobile` — React Native + Expo Router)
- Use React Native logical style properties exclusively: `marginStart`, `marginEnd`, `paddingStart`, `paddingEnd`, `start`, `end`, `borderStartWidth`, `borderEndWidth`.
- For `Text` alignment: prefer `textAlign: 'left'` **only** when `I18nManager.isRTL` is synced, or explicitly bind `writingDirection: isRTL ? 'rtl' : 'ltr'` and `textAlign: isRTL ? 'right' : 'left'` on form inputs and dynamic text blocks so mixed Arabic/English text never shifts unpredictably.
- **Runtime Language Toggle Handling**: Toggling between `ar` and `en` requires `I18nManager.allowRTL(true)` + `I18nManager.forceRTL(isArabic)` followed by a graceful app layout reload (`Updates.reloadAsync()` in EAS builds or root navigation state key reset in dev) preceded by a lightweight transition/confirmation if unsaved form edits exist.

### 5.3 Directional Mirroring Rules (Mirrored vs. Non-Mirrored Matrix)

| UI Element | Arabic (`ar`, RTL) Behavior | English (`en`, LTR) Behavior | Mirror? |
| :--- | :--- | :--- | :--- |
| **Page / Screen Flow** | Reads & aligns Right-to-Left | Reads & aligns Left-to-Right | **YES** |
| **Mobile 5-Tab Bar Order** | `Discovery` rightmost -> `Account` leftmost | `Discovery` leftmost -> `Account` rightmost | **YES** |
| **Admin Sidebar Position** | Docked on physical **Right** (`start`) | Docked on physical **Left** (`start`) | **YES** |
| **Navigation Back Arrow** | Points Right (`→`) | Points Left (`←`) | **YES** |
| **List / Card Chevron** | Points Left (`‹`) to indicate push forward | Points Right (`›`) to indicate push forward | **YES** |
| **Slide-Over Drawers** | Enters from physical **Left** (`end`) for inspection drawers; Nav drawer from **Right** (`start`) | Enters from physical **Right** (`end`) for inspection drawers; Nav drawer from **Left** (`start`) | **YES** |
| **Horizontal Progress Bars & Steppers** | Fill & step sequence runs Right-to-Left | Fill & step sequence runs Left-to-Right | **YES** |
| **Search Input Icons** | Magnifier at Right (`start`); Clear `×` at Left (`end`) | Magnifier at Left (`start`); Clear `×` at Right (`end`) | **YES** |
| **Form Labels & Helper Text** | Right-aligned (`text-start`) | Left-aligned (`text-start`) | **YES** |
| **Toggle Switches** | Thumb moves Right-to-Left (`ON` at Left / end, or consistent OS native switch) | Thumb moves Left-to-Right (`ON` at Right) | **YES** |
| **SHARK Brand Logo & Wordmark** | Never horizontally flipped; stays structurally intact | Never horizontally flipped | **NO** |
| **Checkmarks (`✓`) & Verification Shield** | Never horizontally flipped | Never horizontally flipped | **NO** |
| **Time-Series Financial Charts** | Time X-axis remains Left-to-Right (oldest left, newest right) with localized Arabic axis labels | Time X-axis remains Left-to-Right | **NO** |
| **OTP / Verification Codes** | Digits always input Left-to-Right (`dir="ltr"`, `unicode-bidi: isolate`) | Left-to-Right | **NO** |
| **Emails, URLs, Phone Numbers** | Isolated LTR (`dir="ltr"` + `text-align: end/start` container) so `+966` never flips to `966+` | Left-to-Right | **NO** |
| **Currency Codes & Tickers** | Standardized codes (`USD`, `SAR`, `AED`) stay LTR inside BiDi isolate | Left-to-Right | **NO** |
| **PDF / Pitch Deck Pages & Media Timeline** | Scrub bar & page order remain Left-to-Right | Left-to-Right | **NO** |

### 5.4 Localized Numbers, Currencies & Dates

1. **Calendar System**: **Gregorian Calendar ONLY** (`calendar: 'gregory'`) across both `ar` and `en` (`Intl.DateTimeFormat('ar-SA-u-ca-gregory', ...)` or `'ar-EG'` Gregorian) so financial quarters, audit timestamps, and pitch deadlines match across regions.
2. **Digit System**: **Western Arabic Numerals (`0–9`)** (`numberingSystem: 'latn'`, e.g., `ar-SA-u-nu-latn-ca-gregory`) for all monetary values, percentages, IDs, and dates.
3. **Formatting Examples**:
   - **Currency (Full)**: `en` -> `$2,500,000` | `ar` -> `2,500,000 $` (or `2,500,000 USD` via `Intl.NumberFormat('ar-u-nu-latn', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`).
   - **Compact Raise Target**: `en` -> `$2.5M` | `ar` -> `2.5 مليون USD` (explicit localized suffix helper in `@shark/utils` to avoid platform Intl compact differences between iOS JSC/Hermes and Node).
   - **Ticket Range**: Always wrap range values cleanly (`$250K – $1M` / `250 ألف – 1 مليون USD`).
   - **Dates**: `en` -> `19 Nov 2026` / `19 Nov 2026, 14:30` | `ar` -> `19 نوفمبر 2026` / `19 نوفمبر 2026، 14:30`.

---

## 6. Navigation & Screen Architecture

### 6.1 Mobile Application (`apps/mobile` — Expo Router)

#### A. Auth & Account Gate Stack (`app/(auth)/`)
1. **`Welcome` (`/welcome`)**: Brand mark, concise value proposition, persistent `العربية | English` pill toggle in top-end corner, **Create Account** (Primary), **Sign In** (Secondary), and **Explore Public Network** (Ghost — opens `Discovery` in public read-only mode).
2. **`Login` (`/login`)**: Email + Password (with visibility toggle), Forgot Password link, inline validation, non-revealing auth error banner ("Invalid email or password"), link to Register.
3. **`Register` (`/register`)**: Full Name, Email, Password (live strength rules), Confirm Password, Terms & Privacy consent checkbox (`44pt` hit area). Submits account strictly with server-assigned `account_status = 'pending'`.
4. **`Account Type Selection` (`/account-type`)**: Rich selectable radio cards for **Investor** (`مستثمر`), **Founder** (`مؤسس شركة`), or **Network Member** (`عضو بالشبكة`). **`admin` is NEVER rendered or selectable.**
5. **`Profile Setup` (`/profile-setup`)**: Role-adaptive form:
   - *Investor*: Organization/Fund Name, Investor Type, Ticket Size Min/Max, Preferred Stages, Target Sectors (multi-select chips), Country, Bio.
   - *Founder*: Job Title, Startup Summary, Country, Preferred Language, Bio.
   - *Member*: Expertise, Affiliation, Areas of Interest, Country, Short Bio.
6. **`Verification` (`/verification`)**: Document upload to private `verification-documents` bucket (Commercial Registration / Investor Accreditation / National ID or Passport). Shows allowed MIME types (`PDF, JPG, PNG`), max file size, upload progress bar, replaceable file preview chip, and "Submit Verification" / "Skip for Now" CTAs.
7. **`Pending Approval` (`/pending-approval`)**: Calm `Info/Warning` visual state — Vertical 3-step timeline (`Account Created ✓` -> `Verification Under Review ●` -> `Full Access Granted ○`), **"Explore Approved Public Profiles"** CTA (allows browsing approved Investors & Companies ONLY, with Pitches strictly gated), Refresh Status button, Update Verification Docs CTA, Sign Out (`Ghost`).
8. **`Rejected Account` (`/rejected`)**: `ErrorTint` alert card (`#FDECEC` / `#B02230`) displaying admin rejection reason (if provided), Contact Support CTA, Delete Account link, Sign Out.
9. **`Suspended Account` (`/suspended`)**: High-clarity `ErrorTint` blocked screen explaining temporary/compliance suspension, Support/Compliance Appeal CTA, Sign Out. Clears sensitive cache and blocks protected tab navigation.
10. **`Forgot Password` (`/forgot-password`)**: Email input, Submit CTA, non-enumerating confirmation state ("If an account exists for this email, instructions have been sent").
11. **`Reset Password` (`/reset-password`)**: Deep-linked token validation -> New Password + Confirm Password -> Success confirmation -> Navigate to Login.

#### B. Main 5-Tab Navigation (`app/(tabs)/`)
Tabs render in start-to-end order (Right-to-Left in Arabic, Left-to-Right in English). Each tab bar item displays a `24px` outline/filled icon + `12px` single-line label, active tint `#142B49`, inactive tint `#687386`, minimum `44pt` touch width, top `1px #E2E8F0` border.

| Order (Start -> End) | Route | Label (`ar` / `en`) | Screen Composition & Purpose |
| :--- | :--- | :--- | :--- |
| **1 (Landing)** | `discovery` (`Discovery`) | `استكشاف` / `Discovery` | **Default Landing Screen.** Header with Greeting + Search trigger (`search`) + Notification Bell; Sector Quick-Browse rail (`sectors/[slug]`); Featured Approved Investors; Featured Approved Companies; Featured Approved Pitches (**queried & rendered ONLY for `approved` users** — Guests & `pending` users see an informational onboarding banner instead). |
| **2** | `investors` | `المستثمرون` / `Investors` | Search Input + Filter Bottom Sheet (Investor Type, Ticket Range, Sectors, Stages, Country) -> Active Filter Chips -> Paginated `InvestorCard` vertical list (`FlatList` with bounded keyset pagination). |
| **3** | `companies` | `الشركات` / `Companies` | Search Input + Filter Bottom Sheet (Sector, Funding Stage, Country, Verified Only) -> Paginated `CompanyCard` list. |
| **4** | `pitches` | `العروض` / `Pitches` | **Approved Users Only:** Search Input + Filter Bottom Sheet (Stage, Target Amount Range, Instrument, Sector) -> Paginated `PitchCard` list (`approved` + explicitly granted `restricted` pitches). **Guests & `pending` users:** Renders a Gated Authorization Card ("Available to Approved Members") without querying `pitches`. |
| **5** | `account` | `حسابي` / `Account` | `ProfileHeader` (Avatar, Role & Account Status Badges) + sub-screen links: `edit-profile`, `my-company` & `my-pitches` (Founder), `saved`, `notifications`, `settings`, `language` (`العربية / English`), `privacy-security`, `support`, `delete-account`, Sign Out (`ConfirmationDialog`). |

#### C. Detail Screens, Guest/Pending Gate & Confidential Deck Viewer UX
- **Detail & Discovery Sub-Routes**: `search`, `sectors/[slug]`, `investors/[id]`, `companies/[id]`, `pitches/[id]`, `pitches/[id]/viewer`.
  - Standardized Hero header (`ProfileHeader` or Pitch Hero), tabular metric grid, narrative overview, related entities (e.g., Company -> Active Pitches visible only to `approved` users), and contextual sticky bottom action bar (Safe Area padded).
- **Guest & Pending Access-Gate Pattern**:
  - Guests and `pending` users MUST NEVER trigger queries against `pitches` or `pitch_documents`.
  - Tapping the **Pitches** tab or protected actions (Bookmark, Contact/Interest, Submit Pitch) displays a uniform Gate Modal / Bottom Sheet (`radius.lg` top corners):
    - *Guest*: **Create Account** (`Primary`), **Sign In** (`Secondary`), **Continue Browsing** (`Ghost`).
    - *Pending*: Status indicator (`WarningTint`) explaining pitch access unlocks upon admin approval, with **View Status** (`Primary`) and **Dismiss** (`Ghost`).
- **Restricted Pitch & Confidential Deck Viewer UX (`pitches/[id]` & `pitches/[id]/viewer`)**:
  - When an **Approved User** views a **`restricted` pitch** or a **`restricted` pitch document** (`pitch_documents.is_restricted = true`) without an explicit access grant (`pitch_access_grants`):
    1. Public/teaser metadata (`Title`, `Company Name`, `Sector`, `Stage`) remains legible.
    2. Confidential sections (**Financial Projections**, **Cap Table**, **Restricted Pitch Deck / Data Room Files**) render inside a **Restricted Access Container** (`#EDF2F7` backdrop, `1px dashed #808A9D`, simulated redacted lines, centered Lock Icon inside `#E8EEF5` circle, clear label *"Restricted Investment Material — Explicit Access Grant Required"*).
  - When an **Authorized User** opens a document in `pitches/[id]/viewer` (`pitch-documents` private bucket):
    1. Client requests a short-lived **Signed URL** (`60–120s` TTL) from Edge Function `get-signed-document-url`.
    2. Viewer displays security notice banner (`InfoTint #EAF3FC`): *"Confidential Document • Access monitored • Do not redistribute"* plus subtle user-identifying watermark (`email` / timestamp).
    3. On long reading sessions or if TTL expires, client seamlessly refreshes the Signed URL (if still authorized) or displays a one-tap *"Refresh Secure Link"* inline card rather than a broken PDF frame.

---

### 6.2 Admin Dashboard (`apps/admin` — Next.js App Router)

#### A. Responsive Shell Layout
- **Sidebar (`260px` desktop, `72px` collapsed, slide drawer `< 1024px`)**: Primary Navy (`#142B49`) navigation rail for unmistakable visual distinction from the Mobile App, with White `#FFFFFF` text (`14.27:1`), Active Item highlight `#1E3F6B` + `3px` start accent bar (`#D99A26` or `#FFFFFF`), and grouped module categories:
  - *Core*: Overview (`/overview`)
  - *Directory & Trust*: User Management (`/users`), Investor Management (`/investors`), Company Management (`/companies`), Company Verification (`/verifications`)
  - *Deal Flow*: Pitch Management (`/pitches`), Pitch Review (`/pitch-reviews`), Document Management (`/documents`)
  - *Operations & Governance*: Notifications (`/notifications`), Admin Roles & Permissions (`/admin-roles`), Activity Logs (`/activity-logs`), Analytics (`/analytics`), System Settings (`/settings`)
- **Top Utility Bar (`64px`, `#FFFFFF`, `1px solid #E2E8F0` bottom border)**: Sidebar collapse toggle, Page Breadcrumb (`text-start`), Global Quick Search (`⌘K`), Locale Toggle (`العربية / EN`), Pending Queue Counter badge, Admin Profile Menu + Sign Out.

#### B. All 13 Admin Modules UX Specifications

| # | Module & Route | Layout Pattern | Core UI Elements, Actions & Safety Controls |
| :--- | :--- | :--- | :--- |
| **1** | **Overview** (`/overview`) | 4-Col KPI Grid + 2-Col Action Queue & Trend Charts + Recent Audit Feed | KPI Cards: Pending User Approvals, Pending Company Verifications, Pending Pitch Reviews, Approved Investors/Companies/Pitches totals (each clickable to jump directly into filtered queue). SLA moderation queues, recent `activity_logs` stream. |
| **2** | **User Management** (`/users`) | `FilterBar` + `DataTable` + End Slide-Over Drawer (`480px`) | Filter by `user_role` (`investor \| founder \| member \| admin`) & `account_status` (`pending \| approved \| rejected \| suspended`). Row actions: Inspect (Signed URL verification docs), **Approve** (`ConfirmationDialog`), **Reject** (mandatory reason input), **Suspend** (mandatory reason), **Reactivate**, **Assign Role** (`super_admin` gated + confirmation). |
| **3** | **Investor Management** (`/investors`) | `FilterBar` + `DataTable` + Inspection Drawer | Filter by Investor Type, Accreditation/Status, Sector Focus, Ticket Range. Inspect thesis, normalize directory metadata, toggle **Featured Investor** badge on Discovery. |
| **4** | **Company Management** (`/companies`) | `FilterBar` + `DataTable` + Inspection Drawer | Filter by Sector, Stage, Country, `company_status` (`draft \| pending \| approved \| rejected \| suspended`). View founder ownership, active pitches, **Approve / Reject / Request Additional Info / Suspend / Reactivate / Featured** controls. |
| **5** | **Company Verification** (`/verifications`) | **Split-View Review Workspace** (`360px` Queue List + Main Detail/Document Pane) | Dedicated queue for `verification_status = 'pending'`. Displays legal registration metadata and secure **Signed-URL Document Preview** (`verification-documents` bucket). Decision bar: **Verify Company**, **Request Additional Documents**, **Reject Verification** (mandatory reason -> logged to `activity_logs`). |
| **6** | **Pitch Management** (`/pitches`) | `FilterBar` + `DataTable` + Pitch Detail Drawer | Master repository across all statuses (`draft \| pending \| approved \| rejected \| closed \| restricted`). Filter by Stage, Target Amount, Sector, Status. **Restrict / Unrestrict / Close / Featured / Manage Access Grants** actions. |
| **7** | **Pitch Review** (`/pitch-reviews`) | **Split-View Due Diligence Workspace** | Focused workbench for `pitch_status = 'pending'`. Side-by-side pitch summary, financial figures (`tabular-nums`), compliance checklist, Signed-URL attachment preview (`pitch-documents`), and **Approve Pitch / Approve as Restricted / Request Additional Info / Reject Pitch** controls with mandatory feedback. |
| **8** | **Document Management** (`/documents`) | `FilterBar` + `DataTable` + Access Control Drawer | Unified inventory of `pitch-documents` and `verification-documents` metadata. Columns: File Name, Bucket, Owner Entity, Visibility Tier (`standard \| restricted`), Size, Upload Date. Actions: Preview via Signed URL (audit-logged), **Restrict / Unrestrict Document**, Manage Grants, Archive/Disable violating file (`ConfirmationDialog`). |
| **9** | **Notifications** (`/notifications`) | Split Composer + Delivery History `DataTable` | Compose in-app & push notifications with **mandatory Bilingual Tabs (`العربية` + `English`)** before send! Target audience selector (All Approved Users, By Role, By Sector, Specific User). Live Mobile Banner Preview card + Confirmation Dialog before broadcast. |
| **10** | **Admin Roles & Permissions** (`/admin-roles`) | Role Cards + Permission Matrix Table + Admin Assignment Modal | Visualizes exact permission matrix (`super_admin`, `operations_admin`, `compliance_reviewer`, `content_moderator`, `analyst_readonly`). Assign/revoke admin sub-roles (`ConfirmationDialog` + prevents self-demoting last `super_admin`). Clear banner stating permissions are enforced server-side via RLS & Server Actions. |
| **11** | **Activity Logs** (`/activity-logs`) | Read-Only `FilterBar` + `DataTable` + Diff Inspector Drawer | **Immutable Audit Log.** Filter by Actor, Action Type, Target Entity (`user \| company \| pitch \| document \| setting`), Date Range (Gregorian). Drawer shows `before` vs `after` JSON metadata diff in monospace (`dir="ltr"`), timestamp, and actor role. CSV export action (`audit_log.exported`). Zero edit/delete buttons exist. |
| **12** | **Analytics** (`/analytics`) | Date Range Bar + Metric Cards + Chart Grid | Onboarding Funnel (`pending -> approved`), Active Companies & Verification rate, Pitch moderation SLA turnaround, Sector distribution, Privacy-safe aggregated metrics. Charts follow non-mirrored X-axis timelines with localized axis/tooltip labels. |
| **13** | **System Settings** (`/settings`) | Vertical Section Tabs + Form Cards + Guarded Sticky Save Bar | Sections: Registration toggle, Maintenance banner (`ar`/`en`), Sector Taxonomy CRUD (`name_ar`, `name_en`, slug, sort order), Upload Size & MIME limits, Signed URL TTL bounds, Support channels. Any change triggers a **Confirmation Dialog** summarizing modified keys and logs before/after snapshot to `activity_logs`. |

---

## 7. Reusable Component Contracts

Every shared component below MUST be implemented using `@shark/design-tokens` without inline magic numbers, adhering to `>= 44pt` touch targets, full RTL/LTR support, and WCAG AA contrast.

### 7.1 Primary Button (`Button variant="primary"`)
- **Purpose**: Single highest-priority action per screen or card footer (e.g., Sign In, Submit Pitch, Approve User).
- **Props Contract**:
  ```ts
  export interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'md' | 'lg'; // md = 44px height, lg = 48px height
    label: string;
    leadingIcon?: IconName;
    trailingIcon?: IconName; // Auto-mirrors directional icons in RTL
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    onPress: () => void;
    accessibilityHint?: string;
    testID?: string;
  }
  ```
- **Visual Specs**: Fill `#142B49`, Text `#FFFFFF` (`14.27:1`), Radius `8px` (`radius.sm`), Height `44px` (`md`) or `48px` (`lg`), Horizontal Padding `20px` (`space.5`), Icon-Text gap `8px` (`space.2`), Typography `bodyBase` SemiBold (`600`).
- **States**:
  - `hover` (Web): `#0F2138` (`16.22:1`)
  - `pressed`: `#0A1728` (`18.01:1`), subtle `scale(0.985)` on mobile
  - `focus-visible` (Web): `2px solid #2878C7` outer ring with `2px` white offset
  - `disabled`: `#EDF2F7` fill, `#687386` -> **use `#525D70`** text (`5.90:1`!) + `cursor: not-allowed` (or `#CBD5E1` tint with `#525D70` label so disabled state remains readable while visually subdued)
  - `loading`: Renders inline `ActivityIndicator` / spinner (`#FFFFFF`), locks `onPress`, preserves button width to prevent layout jump, sets `aria-busy="true"`
- **RTL & A11y**: `flexDirection: 'row'` reverses automatically in RTL; directional arrow icons mirror; `accessibilityRole="button"`, `accessibilityState={{ disabled: disabled || loading, busy: loading }}`.

### 7.2 Secondary Button (`Button variant="secondary" | "ghost" | "danger"`)
- **Purpose**: Supporting actions (`secondary`), low-emphasis dismiss/cancel (`ghost`), and irreversible destructive actions (`danger`).
- **Visual Specs**:
  - `secondary`: Fill `#FFFFFF`, Border `1.5px solid #142B49`, Text `#142B49` (`14.27:1`), Radius `8px`, Min Height `44px`. Hover: `#E8EEF5` tint; Pressed: `#DCE6F2`.
  - `ghost`: Fill `transparent`, Text `#142B49` (`14.27:1` on White), Min Height `44px`. Hover: `#EDF2F7`.
  - `danger`: Fill `#DC3545`, Text `#FFFFFF` (`4.53:1` — or `#B02230` `6.74:1` on `#F7F9FC` hover/pressed `#961B27`). Never use bare red outline for primary destructive confirm; always pair with Trash/Alert icon.
- **RTL & A11y**: Identical logical flex order and `44px` minimum hit target.

### 7.3 Text Input (`TextInput`)
- **Purpose**: Single-line, password, numeric/currency, and multiline text entry.
- **Props Contract**:
  ```ts
  export interface TextInputProps {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    helperText?: string;
    errorMessage?: string;
    required?: boolean;
    secureTextEntry?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    forceLtrValue?: boolean; // True for email, URL, phone, OTP
    leadingIcon?: IconName;
    trailingAction?: { icon: IconName; label: string; onPress: () => void };
    disabled?: boolean;
    maxLength?: number;
    testID?: string;
  }
  ```
- **Visual Specs**: Container `#FFFFFF`, Border `1px solid #808A9D` (`3.48:1` WCAG 1.4.11 pass!), Radius `8px` (`radius.sm`), Height `48px` (single line, comfortably above `44pt`), Horizontal padding `12px` (`space.3`), Label `bodySm` SemiBold (`#172033`, marginBottom `8px`), Helper `caption` (`#687386`), Error `caption` (`#B02230` with alert icon).
- **States**:
  - `focus`: Border `2px solid #2878C7` (Web also `0 0 0 3px rgba(40, 120, 199, 0.16)`)
  - `error`: Border `1.5px solid #DC3545` (or `#B02230`), background `#FFFFFF`, Error message `#B02230` (`6.74:1`) + exclamation icon below
  - `disabled`: Background `#EDF2F7`, Border `#CBD5E1`, Text `#525D70` (`5.90:1`)
- **RTL & BiDi**: Label aligns `start`. When `forceLtrValue` is true (email, phone, numeric amount), input text uses `dir="ltr"` while aligning cleanly inside RTL container (`textAlign: isRTL ? 'right' : 'left'` for emails or `left` with `writingDirection: 'ltr'` for phone numbers `+966...`). Password visibility button has `44px × 44px` hit target at `end`.

### 7.4 Search Input (`SearchInput`)
- **Purpose**: Directory filtering (`Investors`, `Companies`, `Pitches`, Admin Tables).
- **Props Contract**:
  ```ts
  export interface SearchInputProps {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    onSubmit?: () => void;
    onClear?: () => void;
    filterCount?: number;
    onFilterPress?: () => void;
    loading?: boolean;
  }
  ```
- **Visual Specs**: Surface `#FFFFFF` (or `#F7F9FC` inside white headers), Border `1px solid #808A9D`, Radius `8px` (`radius.sm`), Height `44px` (Mobile/Admin), Leading Magnifier Icon (`#687386`, `20px`), Clear `×` button (`44px × 44px` touch zone) appearing only when `value.length > 0`, optional trailing Filter icon button with numeric pill badge (`#142B49` fill, `#FFFFFF` count).
- **RTL & A11y**: Magnifier sits at `start` (right in RTL, left in LTR); Clear `×` and Filter button sit at `end`. Web `role="searchbox"`, `aria-label={placeholder}`, Clear button `aria-label={t('common.clearSearch')}`.

### 7.5 Investor Card (`InvestorCard`)
- **Purpose**: Directory card presenting accredited/verified investors without clutter.
- **Props Contract**:
  ```ts
  export interface InvestorCardProps {
    id: string;
    fullName: string;
    headline: string; // e.g., "Managing Partner • Horizon Ventures"
    avatarUrl?: string | null;
    investorTypeLabel: string;
    isVerified: boolean;
    ticketRangeDisplay: string; // Pre-formatted localized tabular string
    sectors: string[]; // Displays up to 3 + "+N" overflow pill
    countryLabel: string;
    isSaved?: boolean;
    onPress: (id: string) => void;
    onToggleSave?: (id: string) => void;
  }
  ```
- **Visual Anatomy**:
  - Card container: `#FFFFFF`, `1px solid #E2E8F0`, `radius.md` (`12px`), `padding: 16px` (`space.4`), `gap: 12px` (`space.3`).
  - Header row: `48px` circular Avatar (or `#E8EEF5` Navy-tinted initials fallback) + Name (`h4`, `#172033`, max 1 line ellipsis) + Verified Check Shield (`#0E7048` / `#16A36A` icon + `StatusBadge` if verified) + `44px × 44px` Save/Bookmark icon button at `end`.
  - Subtitle: Headline + Country (`bodySm`, `#687386`, max 2 lines).
  - Metric Box (`#F7F9FC`, `radius.sm` `8px`, `padding: 12px`, `1px solid #E2E8F0`): Label *"Ticket Size"* (`caption`, `#687386`) + Value (`metricMd` / `bodyBase` Bold `tabular-nums`, `#142B49`).
  - Footer Tags: Up to 3 sector pills (`#EDF2F7` surface, `#525D70` text `5.90:1`, `radius.pill`) + `+N` overflow badge + directional chevron (`‹` RTL / `›` LTR).
- **States & A11y**: Hover/Pressed `#F7F9FC` tint + `#CBD5E1` border; whole card acts as `accessibilityRole="button"` with separate child hit area for Bookmark (`stopPropagation` on Web).

### 7.6 Company Card (`CompanyCard`)
- **Purpose**: Directory card for registered startups & enterprises.
- **Props Contract**:
  ```ts
  export interface CompanyCardProps {
    id: string;
    name: string;
    tagline: string;
    logoUrl?: string | null;
    sectorLabel: string;
    stageLabel: string;
    countryLabel: string;
    verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
    activePitchCount: number;
    onPress: (id: string) => void;
  }
  ```
- **Visual Anatomy**:
  - Card container: `#FFFFFF`, `1px solid #E2E8F0`, `radius.md` (`12px`), `padding: 16px`.
  - Top row: `48px × 48px` rounded-square Logo (`radius.sm` `8px`, `1px solid #E2E8F0` frame so white logos stay visible) + Company Name (`h4`) + `StatusBadge` (only `verified` shown prominently in public directory; `pending`/`rejected` visible to owner & Admin).
  - Tagline (`bodySm`, `#687386`, max 2 lines).
  - Metadata Footer Row: Sector Pill + Stage Pill (`#EDF2F7` bg, `#525D70` text) + Country + Active Pitch indicator (`#E8EEF5` bg, `#142B49` text if `activePitchCount > 0`).
- **RTL & A11y**: Logo sits at `start`, Status badge wraps cleanly without overlapping company name on narrow `360px` screens.

### 7.7 Pitch Card (`PitchCard` — Approved & Restricted/Blurred States)
- **Purpose**: Primary deal-flow unit showing opportunity summary and strictly guarding confidential data.
- **Props Contract**:
  ```ts
  export interface PitchCardProps {
    id: string;
    title: string;
    companyName: string;
    companyLogoUrl?: string | null;
    sectorLabel: string;
    stageLabel: string;
    targetAmountDisplay: string; // Tabular formatted
    equityOfferedDisplay?: string; // Hidden/masked when restricted
    pitchStatus: 'draft' | 'pending' | 'approved' | 'rejected' | 'closed' | 'restricted';
    accessMode: 'full' | 'restricted_locked';
    summaryTeaser: string;
    hasDeckDocument: boolean;
    onPress: (id: string) => void;
    onRequestAccessPress?: (id: string) => void;
  }
  ```
- **Visual Anatomy (`accessMode === 'full'`)**:
  - Card container: `#FFFFFF`, `1px solid #E2E8F0`, `radius.md` (`12px`), `padding: 16px`.
  - Header: Company mini-logo (`32px`) + Company Name (`bodySm`, `#687386`) + `StatusBadge` (in `My Pitches`/Admin; omitted or replaced by Stage Pill in public Approved feed).
  - Title (`h4`, `#172033`, max 2 lines) + Summary teaser (`bodySm`, `#687386`, max 2 lines).
  - 2-Column Financial Strip (`#F7F9FC`, `radius.sm`, `padding: 12px`):
    - Col 1 (`start`): *"Target Raise"* (`caption`) + `targetAmountDisplay` (`metricMd`, `#142B49`, `tabular-nums`)
    - Col 2 (`end`, vertical `1px #E2E8F0` divider): *"Instrument / Equity"* (`caption`) + `equityOfferedDisplay` (`metricMd`, `#172033`, `tabular-nums`)
  - Footer: Stage + Sector chips + `"Deck Attached"` badge (`#EAF3FC` / `#1B5A99`) + View CTA (`44px` tap area).
- **Restricted / Blurred-Teaser State (`accessMode === 'restricted_locked'`)**:
  - **Note on Guests & Pending Users**: Guests and `pending` accounts are gated at the Pitches tab/route level and NEVER fetch `pitches` rows. `restricted_locked` applies when an `approved` user encounters a `restricted` pitch or `restricted` attachment without a `pitch_access_grants` entry (or in Admin/Founder preview contexts).
  - Public metadata (`Title`, `Company Name`, `Sector`, `Stage`, `Target Range` if public) remains sharp and readable.
  - Sensitive financials (`equityOfferedDisplay` / valuation / deck preview strip) render inside a **`Restricted Overlay Box`** (`#EDF2F7` background, `1px dashed #808A9D` border, `radius.sm` `8px`, simulated redacted skeleton bars at `40%` opacity behind a frosted tint).
  - Centered Lock Pill (`#FFFFFF` pill with `1px solid #E2E8F0`, `#142B49` Lock icon + concise state label: e.g., *"Restricted Opportunity — Explicit Clearance Required"*).
  - Tapping the card or overlay routes to Pitch Detail teaser or opens an informational access notice (`onRequestAccessPress`). **Never render real confidential numbers beneath a CSS blur in the DOM/API response—mask server-side!**

### 7.8 Status Badge (`StatusBadge`)
- **Purpose**: Unified status pill across User Accounts, Companies, Verifications, and Pitches. Every variant guarantees WCAG AA contrast (`>= 4.5:1`) and non-color icon redundancy.
- **Props Contract**:
  ```ts
  export type BadgeDomain = 'account' | 'company' | 'verification' | 'pitch';
  export interface StatusBadgeProps {
    domain: BadgeDomain;
    status:
      | 'pending' | 'approved' | 'rejected' | 'suspended'     // account & company (+ draft)
      | 'unverified' | 'verified'                             // verification (+ pending, rejected)
      | 'draft' | 'closed' | 'restricted';                    // pitch (+ pending, approved, rejected)
    label: string; // Localized text from i18n dictionary
    size?: 'sm' | 'md';
  }
  ```
- **Exact Visual & Accessible Token Matrix**:

| Status | Semantic Palette | Background | Border (`1px`) | Text Color | Icon Color & Icon | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `approved` / `verified` | Success | `#E8F7F0` | `#A3DFC3` | `#0E7048` | `#0E7048` (`CheckCircle` / `ShieldCheck`) | **5.54:1** (AA) |
| `pending` (Account / Verification) | Warning | `#FDF5E4` | `#F2D291` | `#664400` | `#8F5E06` (`Clock`) | **8.09:1** (AAA) |
| `pending` (Company / Pitch Under Review) | Info | `#EAF3FC` | `#A9CEF2` | `#1B5A99` | `#1B5A99` (`Eye` / `FileSearch`) | **6.31:1** (AA) |
| `rejected` / `suspended` | Error | `#FDECEC` | `#F5B5BC` | `#B02230` | `#B02230` (`XCircle` / `Ban`) | **5.90:1** (AA) |
| `draft` / `unverified` / `closed` | Neutral | `#EDF2F7` | `#CBD5E1` | `#525D70` | `#525D70` (`FileEdit` / `MinusCircle`) | **5.90:1** (AA) |
| `restricted` | Navy Muted | `#E8EEF5` | `#B8C7DC` | `#142B49` | `#142B49` (`Lock`) | **12.22:1** (AAA) |

- **Anatomy**: `radius.pill` (`9999px`), `paddingVertical: 4px`, `paddingHorizontal: 10px` (`sm`) / `12px` (`md`), Icon `14px`, Gap `4px` (`space.1`), Typography `caption` (`12px` Medium, `allowFontScaling` bounded to `1.25x` inside pills to prevent clipping).

### 7.9 Profile Header (`ProfileHeader`)
- **Purpose**: Identity banner for Mobile Account tab, Investor/Company Detail pages, and Admin Inspection Drawers.
- **Props Contract**:
  ```ts
  export interface ProfileHeaderProps {
    name: string;
    subtitle: string; // Role/Firm or Sector/Country
    avatarUrl?: string | null;
    avatarShape?: 'circle' | 'rounded-square'; // circle for users, rounded-square for companies
    badges: StatusBadgeProps[]; // Max 2 primary badges (e.g., Role + Verified/Status)
    completenessPercent?: number; // Optional 0-100 onboarding bar
    actionSlot?: React.ReactNode; // e.g., Edit Profile or Admin Approve button
  }
  ```
- **Visual Specs**: `#FFFFFF` surface (or `#142B49` Navy hero option on Mobile Account top card with `#FFFFFF` text and `#1E3F6B` surface pills), `64px` avatar/logo (`48px` in compact drawer), `16px` gap between avatar and text stack, `h2` Name, `bodySm` Subtitle, wrapped badge row (`gap: 8px`), optional `6px`-tall progress bar (`#EDF2F7` track, `#16A36A` or `#142B49` fill, direction-mirrored).

### 7.10 Empty State (`EmptyState`)
- **Purpose**: Clear guidance when lists, search queries, notifications, or queues have zero items.
- **Props Contract**:
  ```ts
  export interface EmptyStateProps {
    variant: 'no_data' | 'no_search_results' | 'restricted' | 'error';
    icon: IconName;
    title: string;
    description: string;
    primaryAction?: { label: string; onPress: () => void };
    secondaryAction?: { label: string; onPress: () => void };
  }
  ```
- **Visual Specs**: Centered vertical stack (`padding: 32px` / `space.8`), `64px × 64px` circular icon container (`#E8EEF5` bg, `#142B49` `28px` icon; `#FDECEC` / `#B02230` for `error`), `h3` title (`#172033`, centered), `bodyBase` description (`#687386`, `maxWidth: 360px`, centered), `20px` gap before Primary/Secondary action buttons (`minHeight: 44px`).
- **UX Distinction**: `no_search_results` MUST include a *"Reset Filters / Clear Search"* action; `no_data` guides creation or discovery.

### 7.11 Loading Skeleton (`LoadingSkeleton`)
- **Purpose**: Preserve spatial stability during TanStack Query / Server fetches without jarring layout shifts.
- **Props Contract**:
  ```ts
  export interface LoadingSkeletonProps {
    preset: 'investor_card' | 'company_card' | 'pitch_card' | 'profile_header' | 'table_rows' | 'detail_page';
    count?: number; // Default 3 for lists, 6 for table rows
  }
  ```
- **Visual & Accessibility Specs**:
  - Base bone color `#EDF2F7`, highlight shimmer `#F7F9FC` (subtle horizontal sweep moving start-to-end in active direction, or gentle opacity pulse `0.6 -> 1.0`).
  - **Motion Safety**: Detect `AccessibilityInfo.isReduceMotionEnabled` (Mobile) and `@media (prefers-reduced-motion: reduce)` (Admin) -> disable shimmer sweep and render static `#EDF2F7` bones.
  - Screen reader: Wrapper sets `aria-busy="true"`, `aria-live="polite"`, and single localized label (`"Loading results..."`) while hiding individual bone shapes (`accessibilityElementsHidden={true}` / `aria-hidden="true"`).

### 7.12 Confirmation Dialog (`ConfirmationDialog`)
- **Purpose**: Explicit confirmation before high-impact or irreversible actions (Sign Out, Approve User, Reject Verification, Suspend Account, Restrict Document, Save System Settings).
- **Props Contract**:
  ```ts
  export interface ConfirmationDialogProps {
    open: boolean;
    variant: 'standard' | 'destructive';
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    requireReasonInput?: boolean; // Mandatory for Admin Reject / Suspend / Restrict
    reasonLabel?: string;
    reasonPlaceholder?: string;
    loading?: boolean;
    onConfirm: (reason?: string) => void;
    onCancel: () => void;
  }
  ```
- **Visual & UX Specs**:
  - Backdrop: `rgba(20, 43, 73, 0.56)` (`bg.overlay`).
  - Container: `#FFFFFF`, `radius.lg` (`16px`), `maxWidth: 440px` (Admin) / `90%` screen width (Mobile), `padding: 24px`, `elevation.modal`.
  - Optional Audit Reason Field: When `requireReasonInput` is true, renders a multiline `TextInput` (`minHeight: 88px`) and disables `confirmLabel` until `reason.trim().length >= 10` (prevents empty audit logs).
  - Action Button Order: Cancel (`Secondary` / `Ghost`) at `start`, Confirm (`Primary` or `Danger`) at `end` on Desktop/Modal footer (`gap: 12px`, `minHeight: 44px`).
  - **Accessibility**: Focus trap inside modal on Web, `Escape` key closes (unless `loading` is true), returns focus to trigger element upon close. Web `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.

### 7.13 Admin Data Table & Filter Bar (`DataTable` & `FilterBar`)
- **Purpose**: Standard operational surface across all Admin list modules (`Users`, `Investors`, `Companies`, `Pitches`, `Documents`, `Activity Logs`).
- **Props Contract**:
  ```ts
  export interface FilterBarProps {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    searchPlaceholder: string;
    filters: Array<{
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      selectedValues: string[];
      onChange: (values: string[]) => void;
    }>;
    activeFilterCount: number;
    onResetAll: () => void;
  }

  export interface DataTableColumn<T> {
    key: string;
    header: string;
    align?: 'start' | 'end'; // 'end' for numeric/currency columns
    sortable?: boolean;
    width?: string;
    render: (row: T) => React.ReactNode;
  }
  ```
- **Visual & Behavior Specs**:
  - **Filter Bar**: White `#FFFFFF` surface bar (`padding: 16px`, `1px solid #E2E8F0`, `radius.md`), flexible wrap row (`gap: 12px`) containing `SearchInput`, multi-select filter dropdown pills (`height: 44px`), active filter summary chips, and *"Reset Filters"* ghost button when `activeFilterCount > 0`.
  - **Data Table**: Outer container `#FFFFFF`, `1px solid #E2E8F0`, `radius.md`, `overflow-x: auto` with logical scroll shadow indicators on narrow viewports.
  - **Header Row**: `#EDF2F7` fill, `height: 44px`, `#525D70` `caption` SemiBold text (`5.90:1` WCAG AA verified!), `1px solid #E2E8F0` bottom border, sticky top on scroll.
  - **Body Rows**: `#FFFFFF` default, `#F7F9FC` hover, `minHeight: 56px`, `1px solid #E2E8F0` divider, `#172033` `bodyBase` text (`tabular-nums` for amounts, counts, and timestamps).
  - **Row Action Menu**: Fixed `44px × 44px` `MoreHorizontal` button in `end` column opening dropdown menu (`radius.sm`, `elevation.sm`, `44px` menu item height).
  - **Pagination Footer**: `#FFFFFF` footer bar (`padding: 12px 16px`), displaying range (`Showing 1–20 of 148`), page size selector (`20 | 50`), and Previous/Next directional buttons (`44px` height, arrows mirrored in RTL).

---

## 8. Feedback, Error & Security State Patterns

| Scenario | Component / Pattern | Exact UX & Security Behavior |
| :--- | :--- | :--- |
| **Form Validation Error** | Inline `TextInput` error + top summary if > 3 errors | Validated via `@shark/validation` (Zod). Shows `#B02230` icon + clear localized message; focuses first invalid field on submit. |
| **Auth / Backend Rejection** | Non-dismissible Inline Alert Banner (`#FDECEC`, `#B02230`) | **Never** expose raw PostgreSQL/Supabase codes, stack traces, or email enumeration hints. Display friendly localized messages. |
| **Toast Notifications** | Floating Banner (`radius.md`, `elevation.md`, max 1–2 visible) | Auto-dismiss `4s` (`success`/`info`), persistent until dismissed for `error`/`warning`. Always includes dismiss `×` (`44px` target) and `aria-live="polite"`. |
| **Offline / Network Error** | `EmptyState variant="error"` or Top Reconnect Strip | Distinguishes offline state from empty results; provides single-tap **"Retry"** button calling TanStack Query `refetch()`. |
| **Signed URL Expired (Documents)** | Inline Document Error Card (`#FDF5E4` / `#664400`) | Detects 403/400 expired storage link on pitch decks/verification docs and shows **"Refresh Secure Link"** button instead of broken PDF frame. |

---

## 9. Governance & Engineering Handoff Checklist

Before any Mobile (`Agent 3`) or Admin (`Agent 5`) PR passes Design & QA (`Agent 6`) review:

1. **Zero Hardcoded Styles**: All colors, radii, spacing, and typography derive from `@shark/design-tokens`.
2. **WCAG AA Compliance Verified**: No `#687386` normal text on `#EDF2F7` (use `#525D70`), no white text on `#D99A26` or `#16A36A`, all form input outlines `>= 3.0:1` (`#808A9D`), all interactive targets `>= 44pt / 44px`.
3. **Bilingual & RTL Parity**: Tested in both `ar` (RTL default) and `en` (LTR) at `360px` Mobile width and `1280px` / `375px` Admin viewports with zero text clipping, zero physical `left/right` CSS hacks, and Gregorian/Latin-digit formatting confirmed.
4. **Confidentiality UI Integrity**: Restricted pitch decks and unverified financial blocks mask data cleanly and rely on backend RLS + Signed URL enforcement—never client-side hiding alone.
