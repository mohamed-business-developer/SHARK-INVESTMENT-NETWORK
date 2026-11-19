import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MobileTabKey } from '@shark/shared-types';
import { formatCompactRaise, formatPercent, formatTicketRange } from '@shark/utils';
import { CompanyCard, InvestorCard, PitchCard } from '@/components/cards';
import { AccessGateModal, BottomTabBarShell, ScreenHeader } from '@/components/navigation';
import {
  AppText,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  FeedbackBanner,
  LoadingSkeleton,
  ProfileHeader,
  SearchInput,
  Select,
  StatusBadge,
  TextInput,
  useToast,
} from '@/components/ui';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';

export default function DesignSystemShowcaseScreen() {
  const { locale, direction, nativeReloadPending, t, toggleLocale } = useLocale();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<MobileTabKey>('discovery');
  const [searchQuery, setSearchQuery] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneErrorValue, setPhoneErrorValue] = useState('+96650');
  const [selectedSector, setSelectedSector] = useState<string | null>('fintech');
  const [investorSaved, setInvestorSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const sectorOptions = [
    { value: 'fintech', label: t.showcase.samples.sectorFintech },
    { value: 'ai', label: t.showcase.samples.sectorAi },
    { value: 'health', label: t.showcase.samples.sectorHealth },
    { value: 'logistics', label: t.showcase.samples.sectorLogistics },
  ];

  const handleNotice = () => {
    showToast('success', t.showcase.samples.toastTriggered);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title={t.app.name}
        subtitle={t.showcase.badge}
        onBack={handleNotice}
        trailingSlot={
          <Button
            variant="secondary"
            size="md"
            leadingIcon="globe"
            label={locale === 'ar' ? t.common.en : t.common.ar}
            onPress={() => {
              void toggleLocale();
            }}
          />
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { direction }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {nativeReloadPending ? (
            <FeedbackBanner variant="info" message={t.showcase.rtlNotice} />
          ) : null}

          <ProfileHeader
            variant="navy"
            name={t.showcase.samples.profileName}
            subtitle={t.showcase.samples.profileSubtitle}
            completenessPercent={85}
            badges={[
              { domain: 'account', status: 'approved', label: t.status.approved },
              { domain: 'verification', status: 'verified', label: t.status.verified },
            ]}
          />

          <View style={styles.section}>
            <AppText variant="h3">{t.showcase.sections.typographyColors}</AppText>
            <Card>
              <AppText variant="display">{t.app.name}</AppText>
              <AppText variant="bodyBase" color={mobileTheme.colors.text.secondary}>
                {t.app.foundationShellSubtitle}
              </AppText>
              <View style={[styles.badgeGrid, { direction }]}>
                <StatusBadge domain="account" status="approved" label={t.status.approved} />
                <StatusBadge domain="account" status="pending" label={t.status.pendingAccount} />
                <StatusBadge domain="company" status="pending" label={t.status.pendingReview} />
                <StatusBadge domain="account" status="rejected" label={t.status.rejected} />
                <StatusBadge domain="account" status="suspended" label={t.status.suspended} />
                <StatusBadge domain="pitch" status="draft" label={t.status.draft} />
                <StatusBadge domain="pitch" status="restricted" label={t.status.restricted} />
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <AppText variant="h3">{t.showcase.sections.buttons}</AppText>
            <Card>
              <View style={styles.stack}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  label={t.showcase.samples.btnPrimary}
                  trailingIcon="arrowRight"
                  mirrorTrailingKind="arrow-forward"
                  onPress={handleNotice}
                />
                <Button
                  variant="secondary"
                  fullWidth
                  label={t.showcase.samples.btnSecondary}
                  onPress={() => setGateOpen(true)}
                />
                <Button
                  variant="danger"
                  fullWidth
                  leadingIcon="trash2"
                  label={t.showcase.samples.btnDanger}
                  onPress={() => setDialogOpen(true)}
                />
                <View style={[styles.rowWrap, { direction }]}>
                  <Button
                    variant="ghost"
                    label={t.showcase.samples.btnGhost}
                    onPress={handleNotice}
                  />
                  <Button
                    variant="primary"
                    loading
                    label={t.showcase.samples.btnLoading}
                    onPress={() => undefined}
                  />
                  <Button
                    variant="primary"
                    disabled
                    label={t.showcase.samples.btnDisabled}
                    onPress={() => undefined}
                  />
                </View>
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <AppText variant="h3">{t.showcase.sections.inputs}</AppText>
            <Card>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t.showcase.samples.searchPlaceholder}
                filterCount={2}
                onFilterPress={handleNotice}
              />
              <TextInput
                label={t.showcase.samples.emailLabel}
                value={email}
                onChangeText={setEmail}
                placeholder={t.showcase.samples.emailPlaceholder}
                keyboardType="email-address"
                forceLtrValue
                required
              />
              <TextInput
                label={t.showcase.samples.passwordLabel}
                value={password}
                onChangeText={setPassword}
                placeholder={t.showcase.samples.passwordPlaceholder}
                secureTextEntry
                required
              />
              <TextInput
                label={t.showcase.samples.errorInputLabel}
                value={phoneErrorValue}
                onChangeText={setPhoneErrorValue}
                forceLtrValue
                keyboardType="phone-pad"
                errorMessage={t.showcase.samples.errorInputMessage}
              />
              <Select
                label={t.showcase.samples.sectorSelectLabel}
                value={selectedSector}
                options={sectorOptions}
                onChange={setSelectedSector}
                required
              />
            </Card>
          </View>

          <View style={styles.section}>
            <AppText variant="h3">{t.showcase.sections.cards}</AppText>
            <InvestorCard
              investor={{
                id: 'inv-1',
                fullName: t.showcase.samples.profileName,
                headline: t.showcase.samples.investorHeadline,
                investorTypeLabel: t.showcase.samples.investorType,
                isVerified: true,
                verifiedLabel: t.status.verified,
                ticketRangeDisplay: formatTicketRange(250_000, 1_000_000, locale),
                ticketLabel: t.showcase.samples.ticketLabel,
                sectors: [
                  t.showcase.samples.sectorFintech,
                  t.showcase.samples.sectorAi,
                  t.showcase.samples.sectorHealth,
                  t.showcase.samples.sectorLogistics,
                ],
                countryLabel: t.showcase.samples.countryKsa,
                isSaved: investorSaved,
              }}
              onPress={handleNotice}
              onToggleSave={() => setInvestorSaved((prev) => !prev)}
            />

            <CompanyCard
              company={{
                id: 'cmp-1',
                name: t.showcase.samples.companyName,
                tagline: t.showcase.samples.companyTagline,
                sectorLabel: t.showcase.samples.sectorLogistics,
                stageLabel: t.showcase.samples.stageSeriesA,
                countryLabel: t.showcase.samples.countryUae,
                verificationStatus: 'verified',
                verificationLabel: t.status.verified,
                activePitchCount: 2,
              }}
              onPress={handleNotice}
            />

            <PitchCard
              pitch={{
                id: 'pit-1',
                title: t.showcase.samples.pitchTitleOpen,
                companyName: t.showcase.samples.companyName,
                sectorLabel: t.showcase.samples.sectorFintech,
                stageLabel: t.showcase.samples.stageSeriesA,
                targetAmountDisplay: formatCompactRaise(2_500_000, locale),
                equityOfferedDisplay: `${formatPercent(15, locale)}`,
                pitchStatus: 'approved',
                statusLabel: t.status.approved,
                accessMode: 'full',
                summaryTeaser: t.showcase.samples.pitchTeaserOpen,
                hasDeckDocument: true,
              }}
              targetLabel={t.showcase.samples.ticketLabel}
              equityLabel={t.showcase.samples.pitchEquityOpen}
              onPress={handleNotice}
            />

            <PitchCard
              pitch={{
                id: 'pit-2',
                title: t.showcase.samples.pitchTitleRestricted,
                companyName: t.showcase.samples.companyName,
                sectorLabel: t.showcase.samples.sectorAi,
                stageLabel: t.showcase.samples.stageSeed,
                targetAmountDisplay: formatCompactRaise(5_000_000, locale),
                pitchStatus: 'restricted',
                statusLabel: t.status.restricted,
                accessMode: 'restricted_locked',
                summaryTeaser: t.showcase.samples.pitchTeaserRestricted,
                hasDeckDocument: true,
              }}
              targetLabel={t.showcase.samples.ticketLabel}
              equityLabel={t.showcase.samples.pitchEquityOpen}
              onPress={handleNotice}
              onRequestAccessPress={() => setGateOpen(true)}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="h3">{t.showcase.sections.feedbackStates}</AppText>
            <FeedbackBanner variant="info" message={t.showcase.samples.bannerInfo} />
            <FeedbackBanner variant="success" message={t.showcase.samples.bannerSuccess} />
            <FeedbackBanner variant="warning" message={t.showcase.samples.bannerWarning} />
            <FeedbackBanner
              variant="error"
              message={t.showcase.samples.bannerError}
              action={{ label: t.common.retry, onPress: handleNotice }}
            />
            <LoadingSkeleton preset="investor_card" count={1} />
            <EmptyState
              variant="no_search_results"
              title={t.states.noSearchTitle}
              description={t.states.noSearchDescription}
              primaryAction={{ label: t.common.resetFilters, onPress: () => setSearchQuery('') }}
            />
            <EmptyState
              variant="error"
              title={t.states.errorTitle}
              description={t.states.errorDescription}
              primaryAction={{ label: t.common.retry, onPress: handleNotice }}
            />
          </View>
        </View>
      </ScrollView>

      <BottomTabBarShell
        activeTab={activeTab}
        isApprovedUser={false}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'pitches') {
            setGateOpen(true);
          }
        }}
      />

      <ConfirmationDialog
        open={dialogOpen}
        variant="destructive"
        title={t.dialogs.destructiveTitle}
        description={t.dialogs.destructiveDescription}
        confirmLabel={t.common.confirm}
        cancelLabel={t.common.cancel}
        requireReasonInput
        onConfirm={() => {
          setDialogOpen(false);
          showToast('warning', t.showcase.samples.toastTriggered);
        }}
        onCancel={() => setDialogOpen(false)}
      />

      <AccessGateModal
        open={gateOpen}
        mode="guest"
        onPrimaryAction={() => setGateOpen(false)}
        onSecondaryAction={() => setGateOpen(false)}
        onDismiss={() => setGateOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bg.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: mobileTheme.layout.mobileScreenPadding,
    paddingBottom: mobileTheme.space[10],
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: mobileTheme.layout.mobileMaxTabletWidth,
    gap: mobileTheme.space[6],
  },
  section: {
    gap: mobileTheme.space[3],
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
  },
  stack: {
    gap: mobileTheme.space[3],
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileTheme.space[2],
    alignItems: 'center',
  },
});
