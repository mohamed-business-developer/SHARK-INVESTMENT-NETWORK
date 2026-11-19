import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ShadowToken } from '@shark/design-tokens';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';

export interface CardProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly elevation?: ShadowToken;
  readonly padding?: number;
  readonly style?: ViewStyle;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function Card({
  children,
  onPress,
  elevation = 'none',
  padding = mobileTheme.space[4],
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  const { direction } = useLocale();
  const shadowStyle = mobileTheme.shadows[elevation].native;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          shadowStyle,
          {
            direction,
            padding,
            backgroundColor: pressed
              ? mobileTheme.colors.bg.surfaceHover
              : mobileTheme.colors.bg.surface,
            borderColor: pressed
              ? mobileTheme.colors.border.hover
              : mobileTheme.colors.border.subtle,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, shadowStyle, { direction, padding }, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    gap: mobileTheme.space[3],
  },
});
