'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { formatCompactRaise, formatDate, formatPercent, formatTicketRange } from '@shark/utils';
import { CompanyCard, InvestorCard, PitchCard } from '@/components/cards';
import { AdminShell } from '@/components/navigation';
import {
  Button,
  Card,
  ConfirmationDialog,
  DataTable,
  EmptyState,
  FeedbackBanner,
  FilterBar,
  LoadingSkeleton,
  ProfileHeader,
  SearchInput,
  Select,
  SignedDocPreviewModal,
  SlideOverDrawer,
  StatusBadge,
  TextInput,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { useLocale } from '@/i18n';

interface SampleApplicantRow {
  readonly id: string;
  readonly name: string;
  readonly org: string;
  readonly roleKey: 'investor' | 'founder';
  readonly roleLabel: string;
  readonly status: 'approved' | 'pending' | 'rejected';
  readonly statusLabel: string;
  readonly amount: string;
  readonly updatedAt: string;
}

export function DesignSystemShowcase() {
  const { locale, t } = useLocale();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 50>(20);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('+96650');
  const [selectedSector, setSelectedSector] = useState('fintech');
  const [investorSaved, setInvestorSaved] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docExpired, setDocExpired] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const sampleRows: readonly SampleApplicantRow[] = useMemo(
    () => [
      {
        id: 'usr-1',
        name: t.showcase.samples.sampleUser1Name,
        org: t.showcase.samples.sampleUser1Org,
        roleKey: 'investor',
        roleLabel: t.showcase.samples.roleInvestor,
        status: 'approved',
        statusLabel: t.status.approved,
        amount: formatTicketRange(250_000, 1_000_000, locale),
        updatedAt: formatDate('2026-11-18T11:20:00Z', locale),
      },
      {
        id: 'usr-2',
        name: t.showcase.samples.sampleUser2Name,
        org: t.showcase.samples.sampleUser2Org,
        roleKey: 'founder',
        roleLabel: t.showcase.samples.roleFounder,
        status: 'pending',
        statusLabel: t.status.pendingAccount,
        amount: formatCompactRaise(2_500_000, locale),
        updatedAt: formatDate('2026-11-19T09:15:00Z', locale),
      },
      {
        id: 'usr-3',
        name: t.showcase.samples.sampleUser3Name,
        org: t.showcase.samples.sampleUser3Org,
        roleKey: 'founder',
        roleLabel: t.showcase.samples.roleFounder,
        status: 'rejected',
        statusLabel: t.status.rejected,
        amount: formatCompactRaise(750_000, locale),
        updatedAt: formatDate('2026-11-15T16:45:00Z', locale),
      },
    ],
    [locale, t],
  );

  const filteredRows = useMemo(() => {
    return sampleRows.filter((row) => {
      if (roleFilter && row.roleKey !== roleFilter) {
        return false;
      }
      if (statusFilter && row.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return row.name.toLowerCase().includes(q) || row.org.toLowerCase().includes(q);
      }
      return true;
    });
  }, [roleFilter, sampleRows, searchQuery, statusFilter]);

  const activeFilterCount = Number(Boolean(roleFilter)) + Number(Boolean(statusFilter));

  const columns: readonly DataTableColumn<SampleApplicantRow>[] = [
    {
      key: 'name',
      header: t.showcase.samples.colName,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          <span className="text-xs text-ink-secondary">{row.org}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: t.showcase.samples.colRole,
      render: (row) => <span className="text-ink-secondary">{row.roleLabel}</span>,
    },
    {
      key: 'status',
      header: t.showcase.samples.colStatus,
      render: (row) => <StatusBadge domain="account" status={row.status} label={row.statusLabel} />,
    },
    {
      key: 'amount',
      header: t.showcase.samples.colAmount,
      align: 'end',
      render: (row) => <span className="font-semibold text-navy">{row.amount}</span>,
    },
    {
      key: 'updated',
      header: t.showcase.samples.colUpdated,
      align: 'end',
      render: (row) => <span className="text-xs text-ink-secondary">{row.updatedAt}</span>,
    },
  ];

  const notifyAction = () => {
    showToast('success', t.showcase.samples.toastMessage);
  };

  return (
    <AdminShell activeModule="design-system" breadcrumb={t.showcase.breadcrumb}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-start">
          <h1 className="text-2xl font-bold text-ink">{t.showcase.heading}</h1>
          <p className="max-w-3xl text-sm text-ink-secondary">{t.showcase.subheading}</p>
        </div>

        <ProfileHeader
          variant="navy"
          name={t.showcase.samples.profileName}
          subtitle={t.showcase.samples.profileSubtitle}
          completenessPercent={90}
          badges={[
            { domain: 'account', status: 'approved', label: t.status.approved },
            { domain: 'verification', status: 'verified', label: t.status.verified },
          ]}
          actionSlot={
            <Button
              variant="secondary"
              label={t.showcase.actions.openDrawer}
              onClick={() => setDrawerOpen(true)}
            />
          }
        />

        {/* Tokens & Badges */}
        <section className="flex flex-col gap-3">
          <h2 className="text-start text-lg font-semibold text-ink">
            {t.showcase.sections.tokens}
          </h2>
          <Card>
            <div className="flex flex-wrap gap-2">
              <StatusBadge domain="account" status="approved" label={t.status.approved} size="md" />
              <StatusBadge
                domain="verification"
                status="verified"
                label={t.status.verified}
                size="md"
              />
              <StatusBadge
                domain="account"
                status="pending"
                label={t.status.pendingAccount}
                size="md"
              />
              <StatusBadge
                domain="company"
                status="pending"
                label={t.status.pendingReview}
                size="md"
              />
              <StatusBadge domain="account" status="rejected" label={t.status.rejected} size="md" />
              <StatusBadge
                domain="account"
                status="suspended"
                label={t.status.suspended}
                size="md"
              />
              <StatusBadge domain="pitch" status="draft" label={t.status.draft} size="md" />
              <StatusBadge
                domain="pitch"
                status="restricted"
                label={t.status.restricted}
                size="md"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
              <div className="rounded-sm bg-navy p-4 text-start text-white">
                <p className="text-xs opacity-80">Primary Navy</p>
                <p className="font-mono text-sm font-semibold" dir="ltr">
                  #142B49 (14.27:1)
                </p>
              </div>
              <div className="rounded-sm border border-line bg-canvas p-4 text-start text-ink">
                <p className="text-xs text-ink-secondary">Canvas &amp; Ink</p>
                <p className="font-mono text-sm font-semibold" dir="ltr">
                  #F7F9FC / #172033
                </p>
              </div>
              <div className="rounded-sm border border-line bg-surfaceSubtle p-4 text-start text-ink-surface">
                <p className="text-xs">Subtle Surface</p>
                <p className="font-mono text-sm font-semibold" dir="ltr">
                  #EDF2F7 / #525D70 (5.90:1)
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Controls: Buttons, Inputs, Banners */}
        <section className="flex flex-col gap-3">
          <h2 className="text-start text-lg font-semibold text-ink">
            {t.showcase.sections.controls}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  label={t.showcase.samples.btnPrimary}
                  trailingIcon={
                    <ArrowRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
                  }
                  onClick={notifyAction}
                />
                <Button
                  variant="secondary"
                  label={t.showcase.samples.btnSecondary}
                  onClick={() => setDrawerOpen(true)}
                />
                <Button
                  variant="danger"
                  label={t.showcase.samples.btnDanger}
                  leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setDialogOpen(true)}
                />
                <Button
                  variant="ghost"
                  label={t.showcase.samples.btnGhost}
                  onClick={notifyAction}
                />
                <Button
                  variant="primary"
                  loading
                  label={t.showcase.samples.btnLoading}
                  onClick={() => undefined}
                />
                <Button
                  variant="primary"
                  disabled
                  label={t.showcase.samples.btnDisabled}
                  onClick={() => undefined}
                />
              </div>

              <div className="mt-2 flex flex-col gap-3">
                <FeedbackBanner variant="info" message={t.showcase.samples.bannerInfo} />
                <FeedbackBanner variant="success" message={t.showcase.samples.bannerSuccess} />
                <FeedbackBanner variant="warning" message={t.showcase.samples.bannerWarning} />
                <FeedbackBanner
                  variant="error"
                  message={t.showcase.samples.bannerError}
                  action={{ label: t.common.retry, onClick: notifyAction }}
                />
              </div>
            </Card>

            <Card>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t.showcase.samples.searchPlaceholder}
                filterCount={activeFilterCount}
              />
              <TextInput
                label={t.showcase.samples.emailLabel}
                value={email}
                onChange={setEmail}
                placeholder={t.showcase.samples.emailPlaceholder}
                type="email"
                forceLtrValue
                required
              />
              <TextInput
                label={t.showcase.samples.passwordLabel}
                value={password}
                onChange={setPassword}
                placeholder={t.showcase.samples.passwordPlaceholder}
                type="password"
                required
              />
              <TextInput
                label={t.showcase.samples.errorPhoneLabel}
                value={phoneError}
                onChange={setPhoneError}
                type="tel"
                forceLtrValue
                errorMessage={t.showcase.samples.errorPhoneMessage}
              />
              <Select
                label={t.showcase.samples.sectorSelectLabel}
                value={selectedSector}
                onChange={setSelectedSector}
                options={[
                  { value: 'fintech', label: t.showcase.samples.sectorFintech },
                  { value: 'ai', label: t.showcase.samples.sectorAi },
                  { value: 'health', label: t.showcase.samples.sectorHealth },
                  { value: 'logistics', label: t.showcase.samples.sectorLogistics },
                ]}
                required
              />
            </Card>
          </div>
        </section>

        {/* Domain Cards */}
        <section className="flex flex-col gap-3">
          <h2 className="text-start text-lg font-semibold text-ink">{t.showcase.sections.cards}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              onSelect={() => setDrawerOpen(true)}
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
              onSelect={() => setDrawerOpen(true)}
            />

            <PitchCard
              pitch={{
                id: 'pit-1',
                title: t.showcase.samples.pitchTitleOpen,
                companyName: t.showcase.samples.companyName,
                sectorLabel: t.showcase.samples.sectorFintech,
                stageLabel: t.showcase.samples.stageSeriesA,
                targetAmountDisplay: formatCompactRaise(2_500_000, locale),
                equityOfferedDisplay: formatPercent(15, locale),
                pitchStatus: 'approved',
                statusLabel: t.status.approved,
                accessMode: 'full',
                summaryTeaser: t.showcase.samples.pitchTeaserOpen,
                hasDeckDocument: true,
              }}
              targetLabel={t.showcase.samples.ticketLabel}
              equityLabel={t.showcase.samples.equityLabel}
              onSelect={() => setDocModalOpen(true)}
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
              equityLabel={t.showcase.samples.equityLabel}
              onSelect={() => setDocModalOpen(true)}
              onRequestAccess={() => setDialogOpen(true)}
            />
          </div>
        </section>

        {/* FilterBar & DataTable */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-start text-lg font-semibold text-ink">
              {t.showcase.sections.table}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                label={t.showcase.actions.toggleSkeleton}
                onClick={() => setShowSkeleton((prev) => !prev)}
              />
              <Button
                variant="secondary"
                label={t.showcase.actions.openDocModal}
                onClick={() => setDocModalOpen(true)}
              />
              <Button
                variant="primary"
                label={t.showcase.actions.triggerToast}
                onClick={notifyAction}
              />
            </div>
          </div>

          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t.showcase.samples.searchPlaceholder}
            activeFilterCount={activeFilterCount}
            onResetAll={() => {
              setSearchQuery('');
              setRoleFilter('');
              setStatusFilter('');
            }}
            filters={[
              {
                key: 'role',
                label: t.showcase.samples.tableFilterRole,
                value: roleFilter,
                onChange: setRoleFilter,
                options: [
                  { value: 'investor', label: t.showcase.samples.roleInvestor },
                  { value: 'founder', label: t.showcase.samples.roleFounder },
                ],
              },
              {
                key: 'status',
                label: t.showcase.samples.tableFilterStatus,
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: 'approved', label: t.status.approved },
                  { value: 'pending', label: t.status.pendingAccount },
                  { value: 'rejected', label: t.status.rejected },
                ],
              },
            ]}
          />

          {showSkeleton ? (
            <LoadingSkeleton preset="table_rows" count={3} />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              variant="no_search_results"
              title={t.states.noSearchTitle}
              description={t.states.noSearchDescription}
              primaryAction={{
                label: t.common.resetFilters,
                onClick: () => {
                  setSearchQuery('');
                  setRoleFilter('');
                  setStatusFilter('');
                },
              }}
            />
          ) : (
            <DataTable
              rows={filteredRows}
              columns={columns}
              getRowKey={(row) => row.id}
              totalCount={filteredRows.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              rowActions={[
                {
                  key: 'inspect',
                  label: t.showcase.actions.openDrawer,
                  onClick: () => setDrawerOpen(true),
                },
                {
                  key: 'reject',
                  label: t.showcase.samples.btnDanger,
                  destructive: true,
                  onClick: () => setDialogOpen(true),
                },
              ]}
            />
          )}
        </section>

        {/* Empty / Error / Restricted States */}
        <section className="flex flex-col gap-3">
          <h2 className="text-start text-lg font-semibold text-ink">
            {t.showcase.sections.states}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <EmptyState
              variant="no_data"
              title={t.states.noDataTitle}
              description={t.states.noDataDescription}
            />
            <EmptyState
              variant="restricted"
              title={t.states.restrictedTitle}
              description={t.states.restrictedDescription}
              primaryAction={{
                label: t.common.requestAccess,
                onClick: () => setDialogOpen(true),
              }}
            />
            <EmptyState
              variant="error"
              title={t.states.errorTitle}
              description={t.states.errorDescription}
              primaryAction={{ label: t.common.retry, onClick: notifyAction }}
            />
          </div>
        </section>
      </div>

      <SlideOverDrawer
        open={drawerOpen}
        title={t.showcase.samples.drawerTitle}
        subtitle={t.showcase.samples.profileSubtitle}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              label={t.common.close}
              onClick={() => setDrawerOpen(false)}
            />
            <Button
              variant="primary"
              label={t.showcase.samples.btnPrimary}
              onClick={() => {
                setDrawerOpen(false);
                notifyAction();
              }}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-ink-secondary">
            {t.showcase.samples.drawerBody}
          </p>
          <FeedbackBanner variant="info" message={t.showcase.samples.bannerInfo} />
        </div>
      </SlideOverDrawer>

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
          showToast('warning', t.showcase.samples.toastMessage);
        }}
        onCancel={() => setDialogOpen(false)}
      />

      <SignedDocPreviewModal
        open={docModalOpen}
        fileName="madar-series-a-pitch-deck.pdf"
        isExpired={docExpired}
        onRefreshLink={() => {
          setDocExpired(false);
          notifyAction();
        }}
        onClose={() => setDocModalOpen(false)}
      />
    </AdminShell>
  );
}
