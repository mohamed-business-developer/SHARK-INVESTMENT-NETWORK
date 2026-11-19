import { Text, type TextProps, type TextStyle } from 'react-native';
import type { FontWeightToken, TypeScaleName } from '@shark/design-tokens';
import { getLogicalTextAlign, getWritingDirection } from '@shark/utils';
import { useLocale } from '@/i18n';
import { getMobileTextStyle, mobileTheme } from '@/theme';

export interface AppTextProps extends TextProps {
  readonly variant?: TypeScaleName;
  readonly weight?: FontWeightToken;
  readonly color?: string;
  readonly align?: 'start' | 'end' | 'center';
  readonly tabularNums?: boolean;
  readonly forceLtr?: boolean;
}

export function AppText({
  variant = 'bodyBase',
  weight,
  color = mobileTheme.colors.text.primary,
  align = 'start',
  tabularNums,
  forceLtr = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { locale } = useLocale();
  const typographyStyle = getMobileTextStyle(variant, locale, { weight, tabularNums });

  const directionalStyle: TextStyle = {
    color,
    writingDirection: getWritingDirection(locale, forceLtr),
    textAlign: forceLtr ? 'left' : getLogicalTextAlign(locale, align),
  };

  return (
    <Text style={[typographyStyle, directionalStyle, style]} {...rest}>
      {children}
    </Text>
  );
}
