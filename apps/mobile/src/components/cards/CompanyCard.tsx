import { StyleSheet, View } from 'react-native';
import type { CompanyCardData } from '@shark/shared-types';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText, Avatar, Card, StatusBadge } from '@/components/ui';
import { AppIcon } from '@/components/ui/Icon';

export interface CompanyCardProps {
  readonly company: CompanyCardData;
  readonly onPress: (id: string) => void;
  readonly testID?: string;
}

export function CompanyCard({ company, onPress, testID }: CompanyCardProps) {
  const { direction, t } = useLocale();
  const activeCountLabel =
    company.activePitchesLabel ??
    interpolate(t.common.activePitchesCount, { count: company.activePitchCount });

  return (
    <Card
      onPress={() => onPress(company.id)}
      accessibilityLabel={`${company.name} — ${company.sectorLabel}`}
      testID={testID}
    >
      <View style={[styles.headerRow, { direction }]}>
        <Avatar name={company.name} imageUrl={company.logoUrl} size={48} shape="rounded-square" />
        <View style={styles.identityCol}>
          <AppText variant="h4" numberOfLines={1}>
            {company.name}
          </AppText>
          <StatusBadge
            domain="verification"
            status={company.verificationStatus}
            label={company.verificationLabel}
            size="sm"
          />
        </View>
        <AppIcon
          name="chevronRight"
          size={18}
          color={mobileTheme.colors.text.secondary}
          directionalKind="chevron-forward"
        />
      </View>

      <AppText variant="bodySm" color={mobileTheme.colors.text.secondary} numberOfLines={2}>
        {company.tagline}
      </AppText>

      <View style={[styles.metaRow, { direction }]}>
        <View style={styles.pill}>
          <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
            {company.sectorLabel}
          </AppText>
        </View>
        <View style={styles.pill}>
          <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
            {company.stageLabel}
          </AppText>
        </View>
        <View style={styles.pill}>
          <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
            {company.countryLabel}
          </AppText>
        </View>
        {company.activePitchCount > 0 ? (
          <View style={styles.activePitchPill}>
            <AppText
              variant="caption"
              weight="600"
              color={mobileTheme.colors.text.brand}
              tabularNums
            >
              {activeCountLabel}
            </AppText>
          </View>
        ) : null}
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: mobileTheme.space[2],
  },
  pill: {
    backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: mobileTheme.space[2] + 2,
    paddingVertical: mobileTheme.space[1],
  },
  activePitchPill: {
    backgroundColor: mobileTheme.colors.interactive.primaryTint,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: mobileTheme.space[2] + 2,
    paddingVertical: mobileTheme.space[1],
  },
});
