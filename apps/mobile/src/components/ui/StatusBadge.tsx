import { StyleSheet, View } from 'react-native';
import {
  resolveStatusBadgeTokens,
  type BadgeDomain,
  type BadgeIconKind,
  type BadgeStatus,
} from '@shark/design-tokens';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon, type SharkIconName } from './Icon';

export interface StatusBadgeProps {
  readonly domain: BadgeDomain;
  readonly status: BadgeStatus;
  readonly label: string;
  readonly size?: 'sm' | 'md';
}

const ICON_MAP: Record<BadgeIconKind, SharkIconName> = {
  'check-circle': 'checkCircle',
  'shield-check': 'shieldCheck',
  clock: 'clock',
  'file-search': 'fileSearch',
  'x-circle': 'xCircle',
  ban: 'ban',
  'file-edit': 'fileEdit',
  'minus-circle': 'minusCircle',
  lock: 'lock',
};

export function StatusBadge({ domain, status, label, size = 'sm' }: StatusBadgeProps) {
  const { direction } = useLocale();
  const tokens = resolveStatusBadgeTokens(domain, status);

  return (
    <View
      style={[
        styles.pill,
        {
          direction,
          backgroundColor: tokens.background,
          borderColor: tokens.border,
          paddingHorizontal: size === 'md' ? mobileTheme.space[3] : mobileTheme.space[2] + 2,
        },
      ]}
    >
      <AppIcon name={ICON_MAP[tokens.icon]} size={14} color={tokens.iconColor} />
      <AppText
        variant="caption"
        weight="600"
        color={tokens.text}
        maxFontSizeMultiplier={1.25}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: mobileTheme.radii.pill,
    borderWidth: 1,
    paddingVertical: mobileTheme.space[1],
    gap: mobileTheme.space[1],
  },
});
