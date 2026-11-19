/**
 * RTL / LTR Directional Helpers & BiDi Isolation Utilities.
 * Reference: docs/DESIGN_SYSTEM.md Section 5
 */

import type { AppLocale } from '@shark/shared-types';

export type TextDirection = 'rtl' | 'ltr';

export function isRtlLocale(locale: AppLocale): boolean {
  return locale === 'ar';
}

export function getDirection(locale: AppLocale): TextDirection {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Icon classifications following the Mirrored vs. Non-Mirrored Matrix (DESIGN_SYSTEM.md §5.3).
 */
export type DirectionalIconKind =
  | 'arrow-back'
  | 'arrow-forward'
  | 'chevron-forward'
  | 'chevron-back'
  | 'stepper-arrow'
  | 'sidebar-toggle'
  | 'external-link'
  | 'brand-logo'
  | 'check'
  | 'shield'
  | 'lock'
  | 'chart-timeline'
  | 'search'
  | 'close';

const MIRRORED_IN_RTL_ICONS: ReadonlySet<DirectionalIconKind> = new Set([
  'arrow-back',
  'arrow-forward',
  'chevron-forward',
  'chevron-back',
  'stepper-arrow',
  'sidebar-toggle',
  'external-link',
]);

export function shouldMirrorIcon(kind: DirectionalIconKind, locale: AppLocale): boolean {
  return isRtlLocale(locale) && MIRRORED_IN_RTL_ICONS.has(kind);
}

export function getIconMirrorTransform(
  kind: DirectionalIconKind,
  locale: AppLocale,
): { transform: Array<{ scaleX: -1 }> } | Record<string, never> {
  return shouldMirrorIcon(kind, locale) ? { transform: [{ scaleX: -1 }] } : {};
}

export function getWritingDirection(locale: AppLocale, forceLtrValue = false): TextDirection {
  if (forceLtrValue) {
    return 'ltr';
  }
  return getDirection(locale);
}

export function getLogicalTextAlign(
  locale: AppLocale,
  align: 'start' | 'end' | 'center' = 'start',
): 'left' | 'right' | 'center' {
  if (align === 'center') {
    return 'center';
  }
  const rtl = isRtlLocale(locale);
  if (align === 'start') {
    return rtl ? 'right' : 'left';
  }
  return rtl ? 'left' : 'right';
}

/**
 * Wraps LTR tokens (emails, +966 phone numbers, URLs, currency tickers) with Unicode
 * Left-to-Right Isolate (U+2066 .. U+2069) so punctuation does not flip in Arabic RTL sentences.
 */
export function isolateLtrValue(value: string): string {
  return `\u2066${value}\u2069`;
}
