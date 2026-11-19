import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { ButtonSize, ButtonVariant } from '@shark/shared-types';
import type { DirectionalIconKind } from '@shark/utils';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon, type SharkIconName } from './Icon';

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly label: string;
  readonly leadingIcon?: SharkIconName;
  readonly trailingIcon?: SharkIconName;
  readonly mirrorLeadingKind?: DirectionalIconKind;
  readonly mirrorTrailingKind?: DirectionalIconKind;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly fullWidth?: boolean;
  readonly onPress: () => void;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  label,
  leadingIcon,
  trailingIcon,
  mirrorLeadingKind,
  mirrorTrailingKind,
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { direction } = useLocale();
  const isDisabled = disabled || loading;

  const height =
    size === 'lg' ? mobileTheme.layout.buttonHeightLg : mobileTheme.layout.buttonHeightMd;

  const resolveColors = (pressed: boolean) => {
    if (isDisabled && !loading) {
      return {
        backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
        borderColor: mobileTheme.colors.border.subtle,
        textColor: mobileTheme.colors.text.secondaryOnSubtle,
      };
    }

    if (variant === 'primary') {
      return {
        backgroundColor: pressed
          ? mobileTheme.colors.interactive.primaryPressed
          : mobileTheme.colors.interactive.primary,
        borderColor: 'transparent',
        textColor: mobileTheme.colors.text.inverse,
      };
    }

    if (variant === 'secondary') {
      return {
        backgroundColor: pressed
          ? mobileTheme.colors.interactive.primaryTintPressed
          : mobileTheme.colors.bg.surface,
        borderColor: mobileTheme.colors.interactive.primary,
        textColor: mobileTheme.colors.text.brand,
      };
    }

    if (variant === 'danger') {
      return {
        backgroundColor: pressed
          ? mobileTheme.colors.status.error.pressed
          : mobileTheme.colors.status.error.fill,
        borderColor: 'transparent',
        textColor: mobileTheme.colors.text.inverse,
      };
    }

    return {
      backgroundColor: pressed ? mobileTheme.colors.bg.surfaceSubtle : 'transparent',
      borderColor: 'transparent',
      textColor: mobileTheme.colors.text.brand,
    };
  };

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => {
        const palette = resolveColors(pressed);
        return [
          styles.base,
          {
            minHeight: height,
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            borderWidth: variant === 'secondary' ? 1.5 : 1,
            width: fullWidth ? '100%' : undefined,
            transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
          },
        ];
      }}
    >
      {({ pressed }) => {
        const palette = resolveColors(pressed);
        return (
          <View style={[styles.contentRow, { direction }]}>
            {loading ? (
              <ActivityIndicator size="small" color={palette.textColor} />
            ) : leadingIcon ? (
              <AppIcon
                name={leadingIcon}
                size={18}
                color={palette.textColor}
                directionalKind={mirrorLeadingKind}
              />
            ) : null}
            <AppText
              variant="bodyBase"
              weight="600"
              color={palette.textColor}
              align="center"
              numberOfLines={1}
            >
              {label}
            </AppText>
            {!loading && trailingIcon ? (
              <AppIcon
                name={trailingIcon}
                size={18}
                color={palette.textColor}
                directionalKind={mirrorTrailingKind}
              />
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: mobileTheme.layout.touchTargetMin,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: mobileTheme.space[5],
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: mobileTheme.space[2],
  },
});
