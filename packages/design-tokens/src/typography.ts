/**
 * Bilingual Typography Foundations for Inter (en) and IBM Plex Sans Arabic (ar).
 * Reference: docs/DESIGN_SYSTEM.md Section 3
 */

export type TypographyLocale = 'ar' | 'en';

export type FontWeightToken = '400' | '500' | '600' | '700';

export const fontFamilies = {
  mobile: {
    en: {
      '400': 'Inter_400Regular',
      '500': 'Inter_500Medium',
      '600': 'Inter_600SemiBold',
      '700': 'Inter_700Bold',
    },
    ar: {
      '400': 'IBMPlexSansArabic_400Regular',
      '500': 'IBMPlexSansArabic_500Medium',
      '600': 'IBMPlexSansArabic_600SemiBold',
      '700': 'IBMPlexSansArabic_700Bold',
    },
  },
  web: {
    en: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    ar: "var(--font-arabic), 'IBM Plex Sans Arabic', 'Tahoma', 'Arial', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
} as const;

export type TypeScaleName =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bodyLg'
  | 'bodyBase'
  | 'bodySm'
  | 'caption'
  | 'overline'
  | 'metricLg'
  | 'metricMd';

export interface TypeScaleSpec {
  readonly fontSize: number;
  readonly fontWeight: FontWeightToken;
  readonly lineHeightEn: number;
  readonly lineHeightAr: number;
  readonly letterSpacingEn: number;
  /** Arabic cursive ligatures require zero negative letter spacing. */
  readonly letterSpacingAr: 0;
  readonly uppercaseInEn?: boolean;
  readonly tabularNums?: boolean;
}

export const typeScale: Record<TypeScaleName, TypeScaleSpec> = {
  display: {
    fontSize: 32,
    fontWeight: '700',
    lineHeightEn: 40,
    lineHeightAr: 48,
    letterSpacingEn: -0.64,
    letterSpacingAr: 0,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeightEn: 32,
    lineHeightAr: 38,
    letterSpacingEn: -0.36,
    letterSpacingAr: 0,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    lineHeightEn: 28,
    lineHeightAr: 34,
    letterSpacingEn: -0.2,
    letterSpacingAr: 0,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeightEn: 26,
    lineHeightAr: 30,
    letterSpacingEn: -0.09,
    letterSpacingAr: 0,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    lineHeightEn: 24,
    lineHeightAr: 28,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
  },
  bodyLg: {
    fontSize: 16,
    fontWeight: '400',
    lineHeightEn: 24,
    lineHeightAr: 28,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
  },
  bodyBase: {
    fontSize: 14,
    fontWeight: '400',
    lineHeightEn: 22,
    lineHeightAr: 24,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
  },
  bodySm: {
    fontSize: 13,
    fontWeight: '400',
    lineHeightEn: 20,
    lineHeightAr: 22,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeightEn: 16,
    lineHeightAr: 20,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600',
    lineHeightEn: 16,
    lineHeightAr: 18,
    letterSpacingEn: 0.66,
    letterSpacingAr: 0,
    uppercaseInEn: true,
  },
  metricLg: {
    fontSize: 28,
    fontWeight: '700',
    lineHeightEn: 34,
    lineHeightAr: 38,
    letterSpacingEn: -0.28,
    letterSpacingAr: 0,
    tabularNums: true,
  },
  metricMd: {
    fontSize: 18,
    fontWeight: '700',
    lineHeightEn: 24,
    lineHeightAr: 28,
    letterSpacingEn: 0,
    letterSpacingAr: 0,
    tabularNums: true,
  },
};

export interface ResolvedTypographyStyle {
  readonly fontSize: number;
  readonly fontWeight: FontWeightToken;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly mobileFontFamily: string;
  readonly webFontFamily: string;
  readonly textTransform: 'uppercase' | 'none';
  readonly tabularNums: boolean;
}

export function resolveTypography(
  token: TypeScaleName,
  locale: TypographyLocale,
  weightOverride?: FontWeightToken,
): ResolvedTypographyStyle {
  const spec = typeScale[token];
  const weight = weightOverride ?? spec.fontWeight;
  const isArabic = locale === 'ar';

  return {
    fontSize: spec.fontSize,
    fontWeight: weight,
    lineHeight: isArabic ? spec.lineHeightAr : spec.lineHeightEn,
    letterSpacing: isArabic ? spec.letterSpacingAr : spec.letterSpacingEn,
    mobileFontFamily: isArabic ? fontFamilies.mobile.ar[weight] : fontFamilies.mobile.en[weight],
    webFontFamily: isArabic ? fontFamilies.web.ar : fontFamilies.web.en,
    textTransform: !isArabic && spec.uppercaseInEn ? 'uppercase' : 'none',
    tabularNums: Boolean(spec.tabularNums),
  };
}
