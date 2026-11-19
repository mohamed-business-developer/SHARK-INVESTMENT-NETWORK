import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  formatCompactRaise,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatTicketRange,
  getDirection,
  getInitials,
  getLogicalTextAlign,
  getWritingDirection,
  interpolate,
  isRtlLocale,
  isolateLtrValue,
  normalizeToLatinDigits,
  parseLocale,
  persistLocale,
  resolvePersistedLocale,
  shouldMirrorIcon,
  type LocaleStorageAdapter,
} from '@shark/utils';

describe('@shark/utils RTL, Formatting, and Persistence', () => {
  it('defaults to Arabic RTL and mirrors directional UI icons appropriately', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');

    expect(shouldMirrorIcon('arrow-back', 'ar')).toBe(true);
    expect(shouldMirrorIcon('chevron-forward', 'ar')).toBe(true);
    expect(shouldMirrorIcon('arrow-back', 'en')).toBe(false);

    // Non-mirrored symbols remain intact in RTL
    expect(shouldMirrorIcon('brand-logo', 'ar')).toBe(false);
    expect(shouldMirrorIcon('check', 'ar')).toBe(false);
    expect(shouldMirrorIcon('shield', 'ar')).toBe(false);
    expect(shouldMirrorIcon('lock', 'ar')).toBe(false);
    expect(shouldMirrorIcon('chart-timeline', 'ar')).toBe(false);
  });

  it('resolves writingDirection, logical text alignment, and BiDi LTR isolation', () => {
    expect(getWritingDirection('ar', false)).toBe('rtl');
    expect(getWritingDirection('ar', true)).toBe('ltr');
    expect(getLogicalTextAlign('ar', 'start')).toBe('right');
    expect(getLogicalTextAlign('ar', 'end')).toBe('left');
    expect(getLogicalTextAlign('en', 'start')).toBe('left');
    expect(isolateLtrValue('+966501234567')).toBe('\u2066+966501234567\u2069');
  });

  it('formats numbers, currencies, compact raises, ranges, and Gregorian dates with Western digits (0-9)', () => {
    expect(normalizeToLatinDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(formatNumber(1250000, 'ar')).toBe('1,250,000');
    expect(formatCurrency(2500000, 'en')).toBe('$2,500,000');
    expect(formatCurrency(2500000, 'ar')).toBe('2,500,000 USD');
    expect(formatCompactRaise(2500000, 'en')).toBe('$2.5M');
    expect(formatCompactRaise(2500000, 'ar')).toBe('2.5 مليون \u2066USD\u2069');
    expect(formatCompactRaise(250000, 'ar')).toBe('250 ألف \u2066USD\u2069');
    expect(formatTicketRange(250000, 1000000, 'en')).toBe('$250K – $1M');
    expect(formatTicketRange(250000, 1000000, 'ar')).toBe(
      '\u2067250 ألف \u2066USD\u2069\u2069 – \u20671 مليون \u2066USD\u2069\u2069',
    );
    expect(formatPercent(12.5, 'ar')).toBe('12.5%');

    const dateAr = formatDate('2026-11-19T14:30:00Z', 'ar', false);
    expect(dateAr).toMatch(/[0-9]/);
    expect(dateAr).not.toMatch(/[٠-٩]/);
    expect(dateAr).toContain('2026');
  });

  it('computes initials and handles locale parsing/interpolation/persistence cleanly', async () => {
    expect(getInitials('Mohamed Hossam')).toBe('MH');
    expect(getInitials('سارة المنصور')).toBe('سا');
    expect(getInitials('سارة منصور')).toBe('سم');
    expect(parseLocale('en-US')).toBe('en');
    expect(parseLocale('ar-SA')).toBe('ar');
    expect(parseLocale('unknown')).toBe('ar');
    expect(interpolate('مرحبًا {{name}}', { name: 'سارة' })).toBe('مرحبًا سارة');

    let storedValue: 'ar' | 'en' | null = null;
    const adapter: LocaleStorageAdapter = {
      getLocale: () => storedValue,
      setLocale: (loc) => {
        storedValue = loc;
      },
    };
    expect(await resolvePersistedLocale(adapter)).toBe('ar');
    await persistLocale(adapter, 'en');
    expect(await resolvePersistedLocale(adapter)).toBe('en');
  });
});
