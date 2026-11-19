import { Pressable, StyleSheet, View } from 'react-native';
import type { FeedbackVariant } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon, type SharkIconName } from './Icon';

export interface FeedbackBannerProps {
  readonly variant: FeedbackVariant;
  readonly message: string;
  readonly title?: string;
  readonly onDismiss?: () => void;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

function getBannerPalette(variant: FeedbackVariant): {
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  icon: SharkIconName;
} {
  switch (variant) {
    case 'success':
      return {
        bg: mobileTheme.colors.status.success.tint,
        border: mobileTheme.colors.status.success.border,
        text: mobileTheme.colors.status.success.text,
        iconColor: mobileTheme.colors.status.success.text,
        icon: 'checkCircle',
      };
    case 'warning':
      return {
        bg: mobileTheme.colors.status.warning.tint,
        border: mobileTheme.colors.status.warning.border,
        text: mobileTheme.colors.status.warning.text,
        iconColor: mobileTheme.colors.status.warning.icon,
        icon: 'alertTriangle',
      };
    case 'error':
      return {
        bg: mobileTheme.colors.status.error.tint,
        border: mobileTheme.colors.status.error.border,
        text: mobileTheme.colors.status.error.text,
        iconColor: mobileTheme.colors.status.error.text,
        icon: 'alertCircle',
      };
    default:
      return {
        bg: mobileTheme.colors.status.info.tint,
        border: mobileTheme.colors.status.info.border,
        text: mobileTheme.colors.status.info.text,
        iconColor: mobileTheme.colors.status.info.text,
        icon: 'info',
      };
  }
}

export function FeedbackBanner({
  variant,
  message,
  title,
  onDismiss,
  action,
}: FeedbackBannerProps) {
  const { direction, t } = useLocale();
  const palette = getBannerPalette(variant);

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          direction,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.iconCol}>
        <AppIcon name={palette.icon} size={18} color={palette.iconColor} />
      </View>

      <View style={styles.textCol}>
        {title ? (
          <AppText variant="bodySm" weight="600" color={palette.text}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="bodySm" color={palette.text}>
          {message}
        </AppText>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            style={styles.actionButton}
          >
            <AppText variant="bodySm" weight="700" color={palette.text}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t.common.dismiss}
          style={styles.dismissBtn}
          hitSlop={6}
        >
          <AppIcon name="x" size={16} color={palette.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: mobileTheme.radii.sm,
    borderWidth: 1,
    padding: mobileTheme.space[3],
    gap: mobileTheme.space[2],
  },
  iconCol: {
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
    gap: mobileTheme.space[1],
  },
  actionButton: {
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  dismissBtn: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
