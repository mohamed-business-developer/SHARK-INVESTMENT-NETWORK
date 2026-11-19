/**
 * Bilingual Formatters (Gregorian Calendar ONLY + Western Arabic Digits 0-9).
 * Reference: docs/DESIGN_SYSTEM.md Section 5.4 & docs/ARCHITECTURE.md UD-06
 */

import type { AppLocale } from '@shark/shared-types';

const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function normalizeToLatinDigits(input: string): string {
  let result = input;
  EASTERN_ARABIC_DIGITS.forEach((digit, index) => {
    result = result.replaceAll(digit, String(index));
  });
  return result;
}

function resolveNumberLocale(locale: AppLocale): string {
  return locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
}

function resolveDateLocale(locale: AppLocale): string {
  return locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-US';
}

export function formatNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const formatted = new Intl.NumberFormat(resolveNumberLocale(locale), {
    numberingSystem: 'latn',
    ...options,
  }).format(value);
  return normalizeToLatinDigits(formatted);
}

export function formatCurrency(
  amount: number,
  locale: AppLocale,
  currency = 'USD',
  maximumFractionDigits = 0,
): string {
  if (!Number.isFinite(amount)) {
    return locale === 'ar' ? `0 ${currency}` : '$0';
  }

  if (locale === 'ar') {
    const numberPart = formatNumber(amount, 'ar', { maximumFractionDigits });
    return `${numberPart} ${currency}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(amount);
  return normalizeToLatinDigits(formatted);
}

function trimTrailingZeroDecimal(num: number): string {
  const fixed = num >= 100 ? num.toFixed(0) : num.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/**
 * Deterministic compact financial formatter matching DESIGN_SYSTEM.md §5.4 across Node, Web, and Hermes.
 */
export function formatCompactRaise(amount: number, locale: AppLocale, currency = 'USD'): string {
  if (!Number.isFinite(amount)) {
    return formatCurrency(0, locale, currency);
  }

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const currencyPrefix = currency === 'USD' ? '$' : `${currency} `;
  const arCurrency = `\u2066${currency}\u2069`;

  if (abs >= 1_000_000_000) {
    const val = trimTrailingZeroDecimal(abs / 1_000_000_000);
    return locale === 'ar'
      ? `${sign}${val} مليار ${arCurrency}`
      : `${sign}${currencyPrefix}${val}B`;
  }

  if (abs >= 1_000_000) {
    const val = trimTrailingZeroDecimal(abs / 1_000_000);
    return locale === 'ar'
      ? `${sign}${val} مليون ${arCurrency}`
      : `${sign}${currencyPrefix}${val}M`;
  }

  if (abs >= 1_000) {
    const val = trimTrailingZeroDecimal(abs / 1_000);
    return locale === 'ar' ? `${sign}${val} ألف ${arCurrency}` : `${sign}${currencyPrefix}${val}K`;
  }

  return formatCurrency(amount, locale, currency);
}

export function formatTicketRange(
  minAmount: number,
  maxAmount: number,
  locale: AppLocale,
  currency = 'USD',
): string {
  const minStr = formatCompactRaise(minAmount, locale, currency);
  const maxStr = formatCompactRaise(maxAmount, locale, currency);
  if (locale === 'ar') {
    return `\u2067${minStr}\u2069 – \u2067${maxStr}\u2069`;
  }
  return `${minStr} – ${maxStr}`;
}

export function formatPercent(value: number, locale: AppLocale, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const formatted = formatNumber(value, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
  return `${formatted}%`;
}

export function formatDate(
  dateInput: Date | string | number,
  locale: AppLocale,
  includeTime = false,
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const datePart = new Intl.DateTimeFormat(resolveDateLocale(locale), {
    calendar: 'gregory',
    numberingSystem: 'latn',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

  if (!includeTime) {
    return normalizeToLatinDigits(datePart);
  }

  const timePart = new Intl.DateTimeFormat(resolveDateLocale(locale), {
    calendar: 'gregory',
    numberingSystem: 'latn',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const separator = locale === 'ar' ? '، ' : ', ';
  return normalizeToLatinDigits(`${datePart}${separator}${timePart}`);
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'S';
  }
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}
