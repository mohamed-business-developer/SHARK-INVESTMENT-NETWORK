import { Pressable, StyleSheet, View } from 'react-native';
import type { InvestorCardData } from '@shark/shared-types';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText, Avatar, Card, StatusBadge } from '@/components/ui';
import { AppIcon } from '@/components/ui/Icon';

export interface InvestorCardProps {
  readonly investor: InvestorCardData;
  readonly onPress: (id: string) => void;
  readonly onToggleSave?: (id: string) => void;
  readonly testID?: string;
}

export function InvestorCard({ investor, onPress, onToggleSave, testID }: InvestorCardProps) {
  const { direction, t } = useLocale();
  const visibleSectors = investor.sectors.slice(0, 3);
  const overflowCount = Math.max(0, investor.sectors.length - 3);

  return (
    <Card
      onPress={() => onPress(investor.id)}
      accessibilityLabel={`${investor.fullName} — ${investor.headline}`}
      testID={testID}
    >
      <View style={[styles.headerRow, { direction }]}>
        <Avatar name={investor.fullName} imageUrl={investor.avatarUrl} size={48} shape="circle" />
        <View style={styles.identityCol}>
          <View style={[styles.nameRow, { direction }]}>
            <AppText variant="h4" numberOfLines={1} style={styles.nameText}>
              {investor.fullName}
            </AppText>
            {investor.isVerified ? (
              <StatusBadge
                domain="verification"
                status="verified"
                label={investor.verifiedLabel}
                size="sm"
              />
            ) : null}
          </View>
          <AppText variant="bodySm" color={mobileTheme.colors.text.secondary} numberOfLines={1}>
            {investor.investorTypeLabel} • {investor.countryLabel}
          </AppText>
        </View>

        {onToggleSave ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onToggleSave(investor.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={investor.isSaved ? t.common.saved : t.common.save}
            accessibilityState={{ selected: Boolean(investor.isSaved) }}
            style={styles.bookmarkBtn}
            hitSlop={6}
          >
            <AppIcon
              name="bookmark"
              size={20}
              color={
                investor.isSaved
                  ? mobileTheme.colors.interactive.primary
                  : mobileTheme.colors.text.secondary
              }
              fill={investor.isSaved ? mobileTheme.colors.interactive.primary : 'none'}
            />
          </Pressable>
        ) : null}
      </View>

      <AppText variant="bodySm" color={mobileTheme.colors.text.secondary} numberOfLines={2}>
        {investor.headline}
      </AppText>

      <View style={[styles.metricBox, { direction }]}>
        <AppText variant="caption" color={mobileTheme.colors.text.secondary}>
          {investor.ticketLabel}
        </AppText>
        <AppText variant="metricMd" color={mobileTheme.colors.text.brand} tabularNums>
          {investor.ticketRangeDisplay}
        </AppText>
      </View>

      <View style={[styles.footerRow, { direction }]}>
        <View style={[styles.chipsWrap, { direction }]}>
          {visibleSectors.map((sector) => (
            <View key={sector} style={styles.chip}>
              <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
                {sector}
              </AppText>
            </View>
          ))}
          {overflowCount > 0 ? (
            <View style={styles.chip}>
              <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
                {interpolate(t.common.moreCount, { count: overflowCount })}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppIcon
          name="chevronRight"
          size={18}
          color={mobileTheme.colors.text.secondary}
          directionalKind="chevron-forward"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[3],
  },
  identityCol: {
    flex: 1,
    gap: mobileTheme.space[1],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
  },
  nameText: {
    flexShrink: 1,
  },
  bookmarkBtn: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricBox: {
    backgroundColor: mobileTheme.colors.bg.canvas,
    borderRadius: mobileTheme.radii.sm,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    padding: mobileTheme.space[3],
    gap: mobileTheme.space[1],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: mobileTheme.space[2],
  },
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
  },
  chip: {
    backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: mobileTheme.space[2] + 2,
    paddingVertical: mobileTheme.space[1],
  },
});
