import type { TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  getSemanticColors,
  layoutTokens,
  radii,
  rawPalette,
  resolveTypography,
  shadows,
  space,
  type FontWeightToken,
  type TypeScaleName,
} from '@shark/design-tokens';
import type { AppLocale } from '@shark/shared-types';

export const mobileTheme = {
  palette: rawPalette,
  colors: getSemanticColors('light'),
  space,
  layout: layoutTokens,
  radii,
  shadows,
} as const;

export function useSharkFonts(): [boolean, Error | null] {
  return useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
}

export function getMobileTextStyle(
  token: TypeScaleName,
  locale: AppLocale,
  options?: {
    readonly weight?: FontWeightToken;
    readonly tabularNums?: boolean;
    readonly fontsLoaded?: boolean;
  },
): TextStyle {
  const resolved = resolveTypography(token, locale, options?.weight);
  const useTabular = options?.tabularNums ?? resolved.tabularNums;
  const fontsLoaded = options?.fontsLoaded ?? true;

  return {
    fontSize: resolved.fontSize,
    lineHeight: resolved.lineHeight,
    letterSpacing: resolved.letterSpacing,
    textTransform: resolved.textTransform,
    includeFontPadding: false,
    ...(fontsLoaded
      ? { fontFamily: resolved.mobileFontFamily }
      : { fontWeight: resolved.fontWeight }),
    ...(useTabular ? { fontVariant: ['tabular-nums'] } : {}),
  };
}
