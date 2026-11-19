import { Pressable, StyleSheet, View } from 'react-native';
import type { MobileTabKey } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/Icon';
import { MOBILE_TABS } from './navigationConfig';

export interface BottomTabBarShellProps {
  readonly activeTab: MobileTabKey;
  readonly isApprovedUser?: boolean;
  readonly onSelectTab: (tab: MobileTabKey) => void;
}

export function BottomTabBarShell({
  activeTab,
  isApprovedUser = false,
  onSelectTab,
}: BottomTabBarShellProps) {
  const { direction, t } = useLocale();

  return (
    <View style={[styles.bar, { direction }]}>
      {MOBILE_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const color = isActive
          ? mobileTheme.colors.interactive.primary
          : mobileTheme.colors.text.secondary;
        const label = t.navigation.tabs[tab.key];

        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            style={styles.tabItem}
          >
            <View style={styles.iconRow}>
              <AppIcon name={tab.icon} size={22} color={color} />
              {tab.requiresApproval && !isApprovedUser ? (
                <View style={styles.lockDot}>
                  <AppIcon name="lock" size={10} color={mobileTheme.colors.text.brand} />
                </View>
              ) : null}
            </View>
            <AppText
              variant="caption"
              weight={isActive ? '700' : '500'}
              color={color}
              align="center"
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    minHeight: mobileTheme.layout.mobileTabBarHeight,
    backgroundColor: mobileTheme.colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border.subtle,
    paddingHorizontal: mobileTheme.space[1],
    paddingVertical: mobileTheme.space[1],
  },
  tabItem: {
    flex: 1,
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    gap: mobileTheme.space[1],
  },
  iconRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockDot: {
    position: 'absolute',
    top: -4,
    end: -10,
    width: 16,
    height: 16,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.interactive.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
