import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/Icon';

export interface ScreenHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly trailingSlot?: ReactNode;
  readonly includeTopSafeArea?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  trailingSlot,
  includeTopSafeArea = false,
}: ScreenHeaderProps) {
  const { direction, t } = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          direction,
          paddingTop: includeTopSafeArea ? insets.top : 0,
        },
      ]}
    >
      <View style={[styles.bar, { direction }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            style={styles.backBtn}
            hitSlop={6}
          >
            <AppIcon
              name="arrowLeft"
              size={20}
              color={mobileTheme.colors.text.primary}
              directionalKind="arrow-back"
            />
          </Pressable>
        ) : null}

        <View style={styles.titleCol}>
          <AppText variant="h4" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color={mobileTheme.colors.text.secondary} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {trailingSlot ? <View style={[styles.trailing, { direction }]}>{trailingSlot}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: mobileTheme.colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: mobileTheme.colors.border.subtle,
  },
  bar: {
    minHeight: mobileTheme.layout.mobileHeaderHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: mobileTheme.space[3],
    gap: mobileTheme.space[2],
  },
  backBtn: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleCol: {
    flex: 1,
    gap: 2,
    paddingHorizontal: mobileTheme.space[1],
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[2],
  },
});
