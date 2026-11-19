import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { StatusBadge, type StatusBadgeProps } from './StatusBadge';

export interface ProfileHeaderProps {
  readonly name: string;
  readonly subtitle: string;
  readonly avatarUrl?: string | null;
  readonly avatarShape?: 'circle' | 'rounded-square';
  readonly badges: readonly StatusBadgeProps[];
  readonly completenessPercent?: number;
  readonly variant?: 'surface' | 'navy';
  readonly actionSlot?: ReactNode;
}

export function ProfileHeader({
  name,
  subtitle,
  avatarUrl,
  avatarShape = 'circle',
  badges,
  completenessPercent,
  variant = 'surface',
  actionSlot,
}: ProfileHeaderProps) {
  const { direction } = useLocale();
  const isNavy = variant === 'navy';

  const clampedPercent =
    typeof completenessPercent === 'number'
      ? Math.max(0, Math.min(100, completenessPercent))
      : undefined;

  return (
    <View
      style={[
        styles.container,
        {
          direction,
          backgroundColor: isNavy
            ? mobileTheme.colors.interactive.primary
            : mobileTheme.colors.bg.surface,
          borderColor: isNavy
            ? mobileTheme.colors.interactive.navActive
            : mobileTheme.colors.border.subtle,
        },
      ]}
    >
      <View style={[styles.topRow, { direction }]}>
        <Avatar name={name} imageUrl={avatarUrl} size={64} shape={avatarShape} />
        <View style={styles.identityCol}>
          <AppText
            variant="h2"
            color={isNavy ? mobileTheme.colors.text.inverse : mobileTheme.colors.text.primary}
            numberOfLines={2}
          >
            {name}
          </AppText>
          <AppText
            variant="bodySm"
            color={
              isNavy
                ? mobileTheme.colors.interactive.primaryTint
                : mobileTheme.colors.text.secondary
            }
            numberOfLines={2}
          >
            {subtitle}
          </AppText>
          {badges.length > 0 ? (
            <View style={[styles.badgesRow, { direction }]}>
              {badges.slice(0, 2).map((badge) => (
                <StatusBadge key={`${badge.domain}-${badge.status}-${badge.label}`} {...badge} />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {typeof clampedPercent === 'number' ? (
        <View
          style={[
            styles.progressTrack,
            {
              direction,
              backgroundColor: isNavy
                ? mobileTheme.colors.interactive.navActive
                : mobileTheme.colors.bg.surfaceSubtle,
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${clampedPercent}%`,
                backgroundColor: mobileTheme.colors.status.success.accent,
              },
            ]}
          />
        </View>
      ) : null}

      {actionSlot ? <View style={styles.actionSlot}>{actionSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    padding: mobileTheme.space[4],
    gap: mobileTheme.space[3],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[4],
  },
  identityCol: {
    flex: 1,
    gap: mobileTheme.space[1],
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
    marginTop: mobileTheme.space[1],
  },
  progressTrack: {
    height: 6,
    borderRadius: mobileTheme.radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: mobileTheme.radii.pill,
  },
  actionSlot: {
    marginTop: mobileTheme.space[1],
  },
});
