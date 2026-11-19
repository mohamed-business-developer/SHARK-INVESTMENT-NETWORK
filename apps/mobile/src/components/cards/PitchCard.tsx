import { StyleSheet, View } from 'react-native';
import type { PitchCardData } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText, Avatar, Card, StatusBadge } from '@/components/ui';
import { AppIcon } from '@/components/ui/Icon';

export interface PitchCardProps {
  readonly pitch: PitchCardData;
  readonly targetLabel: string;
  readonly equityLabel: string;
  readonly onPress: (id: string) => void;
  readonly onRequestAccessPress?: (id: string) => void;
  readonly testID?: string;
}

export function PitchCard({
  pitch,
  targetLabel,
  equityLabel,
  onPress,
  onRequestAccessPress,
  testID,
}: PitchCardProps) {
  const { direction, t } = useLocale();
  const isRestrictedLocked = pitch.accessMode === 'restricted_locked';

  const handlePress = () => {
    if (isRestrictedLocked && onRequestAccessPress) {
      onRequestAccessPress(pitch.id);
      return;
    }
    onPress(pitch.id);
  };

  return (
    <Card
      onPress={handlePress}
      accessibilityLabel={`${pitch.title} — ${pitch.companyName}`}
      testID={testID}
    >
      <View style={[styles.headerRow, { direction }]}>
        <Avatar
          name={pitch.companyName}
          imageUrl={pitch.companyLogoUrl}
          size={32}
          shape="rounded-square"
        />
        <AppText
          variant="bodySm"
          color={mobileTheme.colors.text.secondary}
          numberOfLines={1}
          style={styles.flex}
        >
          {pitch.companyName}
        </AppText>
        <StatusBadge
          domain="pitch"
          status={pitch.pitchStatus}
          label={pitch.statusLabel}
          size="sm"
        />
      </View>

      <View style={styles.titleBlock}>
        <AppText variant="h4" numberOfLines={2}>
          {pitch.title}
        </AppText>
        <AppText variant="bodySm" color={mobileTheme.colors.text.secondary} numberOfLines={2}>
          {pitch.summaryTeaser}
        </AppText>
      </View>

      {isRestrictedLocked ? (
        <View style={styles.restrictedBox}>
          <View style={styles.redactedBars}>
            <View style={[styles.redactedBar, { width: '62%' }]} />
            <View style={[styles.redactedBar, { width: '44%' }]} />
          </View>
          <View style={[styles.lockPill, { direction }]}>
            <AppIcon name="lock" size={14} color={mobileTheme.colors.text.brand} />
            <AppText variant="caption" weight="600" color={mobileTheme.colors.text.brand}>
              {t.states.restrictedOverlayLabel}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={[styles.financialStrip, { direction }]}>
          <View style={styles.metricCol}>
            <AppText variant="caption" color={mobileTheme.colors.text.secondary}>
              {targetLabel}
            </AppText>
            <AppText variant="metricMd" color={mobileTheme.colors.text.brand} tabularNums>
              {pitch.targetAmountDisplay}
            </AppText>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.metricCol}>
            <AppText variant="caption" color={mobileTheme.colors.text.secondary}>
              {equityLabel}
            </AppText>
            <AppText variant="metricMd" color={mobileTheme.colors.text.primary} tabularNums>
              {pitch.equityOfferedDisplay ?? '—'}
            </AppText>
          </View>
        </View>
      )}

      <View style={[styles.footerRow, { direction }]}>
        <View style={[styles.chipsRow, { direction }]}>
          <View style={styles.pill}>
            <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
              {pitch.sectorLabel}
            </AppText>
          </View>
          <View style={styles.pill}>
            <AppText variant="caption" color={mobileTheme.colors.text.secondaryOnSubtle}>
              {pitch.stageLabel}
            </AppText>
          </View>
          {!isRestrictedLocked && pitch.hasDeckDocument ? (
            <View style={styles.deckPill}>
              <AppText variant="caption" weight="600" color={mobileTheme.colors.status.info.text}>
                {t.common.deckAttached}
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
    gap: mobileTheme.space[2],
  },
  flex: {
    flex: 1,
  },
  titleBlock: {
    gap: mobileTheme.space[1],
  },
  financialStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.bg.canvas,
    borderRadius: mobileTheme.radii.sm,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    padding: mobileTheme.space[3],
    gap: mobileTheme.space[3],
  },
  metricCol: {
    flex: 1,
    gap: mobileTheme.space[1],
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: mobileTheme.colors.border.subtle,
  },
  restrictedBox: {
    backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
    borderRadius: mobileTheme.radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: mobileTheme.colors.border.interactive,
    padding: mobileTheme.space[4],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
    gap: mobileTheme.space[2],
  },
  redactedBars: {
    position: 'absolute',
    inset: mobileTheme.space[3],
    justifyContent: 'center',
    gap: mobileTheme.space[2],
    opacity: 0.4,
  },
  redactedBar: {
    height: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.border.hover,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.pill,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    paddingHorizontal: mobileTheme.space[3],
    paddingVertical: mobileTheme.space[2],
    gap: mobileTheme.space[2],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: mobileTheme.space[2],
  },
  chipsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
  },
  pill: {
    backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: mobileTheme.space[2] + 2,
    paddingVertical: mobileTheme.space[1],
  },
  deckPill: {
    backgroundColor: mobileTheme.colors.status.info.tint,
    borderRadius: mobileTheme.radii.pill,
    paddingHorizontal: mobileTheme.space[2] + 2,
    paddingVertical: mobileTheme.space[1],
  },
});
