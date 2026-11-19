/**
 * WCAG 2.1 Relative Luminance and Contrast Ratio Verification Utilities.
 * Reference: docs/DESIGN_SYSTEM.md Section 2.3 & Section 7.8
 */

import { rawPalette } from './colors';

export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function parseHexColor(hex: string): RgbColor {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid 6-digit hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const rl = linearizeChannel(r);
  const gl = linearizeChannel(g);
  const bl = linearizeChannel(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = getRelativeLuminance(foregroundHex);
  const lum2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export type WcagRequirementKind = 'normal_text' | 'large_text_or_ui';

export function meetsWcagAA(
  foregroundHex: string,
  backgroundHex: string,
  kind: WcagRequirementKind = 'normal_text',
): boolean {
  const minRatio = kind === 'normal_text' ? 4.5 : 3.0;
  return getContrastRatio(foregroundHex, backgroundHex) >= minRatio;
}

export interface WcagAuditPair {
  readonly id: string;
  readonly foreground: string;
  readonly background: string;
  readonly kind: WcagRequirementKind;
  readonly minimumRatio: number;
  readonly usage: string;
}

export const canonicalContrastAuditPairs: readonly WcagAuditPair[] = [
  {
    id: 'text-main-on-white',
    foreground: rawPalette.neutral.textMain,
    background: rawPalette.neutral.white,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Primary text on cards, modals, and inputs',
  },
  {
    id: 'text-main-on-canvas',
    foreground: rawPalette.neutral.textMain,
    background: rawPalette.neutral.background,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Primary text on global app canvas',
  },
  {
    id: 'text-main-on-subtle',
    foreground: rawPalette.neutral.textMain,
    background: rawPalette.neutral.lightSurface,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Primary text on subtle chips and tracks',
  },
  {
    id: 'white-on-navy',
    foreground: rawPalette.neutral.white,
    background: rawPalette.brand.navy,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Primary button text and active Admin sidebar links',
  },
  {
    id: 'navy-on-white',
    foreground: rawPalette.brand.navy,
    background: rawPalette.neutral.white,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Secondary/Ghost button text and active mobile tab',
  },
  {
    id: 'navy-on-navy-tint',
    foreground: rawPalette.brand.navy,
    background: rawPalette.brand.navyTint,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Restricted badge and selected chip label',
  },
  {
    id: 'text-secondary-on-white',
    foreground: rawPalette.neutral.textSecondary,
    background: rawPalette.neutral.white,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Metadata and helper text on white surface',
  },
  {
    id: 'text-secondary-on-canvas',
    foreground: rawPalette.neutral.textSecondary,
    background: rawPalette.neutral.background,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Metadata on #F7F9FC canvas',
  },
  {
    id: 'text-secondary-surface-on-subtle',
    foreground: rawPalette.neutral.textSecondarySurface,
    background: rawPalette.neutral.lightSurface,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Table headers, disabled text, and neutral pills on #EDF2F7',
  },
  {
    id: 'warning-text-on-tint',
    foreground: rawPalette.status.warningText,
    background: rawPalette.status.warningTint,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Pending status badges and warning banners',
  },
  {
    id: 'warning-icon-on-tint',
    foreground: rawPalette.status.warningIcon,
    background: rawPalette.status.warningTint,
    kind: 'large_text_or_ui',
    minimumRatio: 3.0,
    usage: 'Warning icons on #FDF5E4 tint',
  },
  {
    id: 'success-text-on-tint',
    foreground: rawPalette.status.successText,
    background: rawPalette.status.successTint,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Approved and verified badges',
  },
  {
    id: 'success-icon-on-white',
    foreground: rawPalette.status.success,
    background: rawPalette.neutral.white,
    kind: 'large_text_or_ui',
    minimumRatio: 3.0,
    usage: 'Verified icons and progress indicators on white',
  },
  {
    id: 'white-on-error-fill',
    foreground: rawPalette.neutral.white,
    background: rawPalette.status.error,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Danger primary button label',
  },
  {
    id: 'error-text-on-tint',
    foreground: rawPalette.status.errorText,
    background: rawPalette.status.errorTint,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Rejected / suspended badges and alert banners',
  },
  {
    id: 'error-text-on-white',
    foreground: rawPalette.status.errorText,
    background: rawPalette.neutral.white,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Inline form validation error text',
  },
  {
    id: 'info-text-on-tint',
    foreground: rawPalette.status.infoText,
    background: rawPalette.status.infoTint,
    kind: 'normal_text',
    minimumRatio: 4.5,
    usage: 'Informational and under-review badges',
  },
  {
    id: 'input-border-on-white',
    foreground: rawPalette.neutral.borderInput,
    background: rawPalette.neutral.white,
    kind: 'large_text_or_ui',
    minimumRatio: 3.0,
    usage: 'Form input outline contrast (WCAG 1.4.11)',
  },
] as const;
