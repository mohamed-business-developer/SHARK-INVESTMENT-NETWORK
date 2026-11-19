'use client';

import { ChevronRight } from 'lucide-react';
import type { CompanyCardData } from '@shark/shared-types';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { Avatar, Card, StatusBadge } from '@/components/ui';

export interface CompanyCardProps {
  readonly company: CompanyCardData;
  readonly onSelect: (id: string) => void;
}

export function CompanyCard({ company, onSelect }: CompanyCardProps) {
  const { t } = useLocale();
  const activeCountLabel =
    company.activePitchesLabel ??
    interpolate(t.common.activePitchesCount, { count: company.activePitchCount });

  return (
    <Card onClick={() => onSelect(company.id)}>
      <div className="flex w-full items-center gap-3">
        <Avatar name={company.name} imageUrl={company.logoUrl} size="md" shape="rounded-square" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-start">
          <h3 className="truncate text-base font-semibold text-ink">{company.name}</h3>
          <StatusBadge
            domain="verification"
            status={company.verificationStatus}
            label={company.verificationLabel}
            size="sm"
          />
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ink-secondary rtl:scale-x-[-1]"
          aria-hidden="true"
        />
      </div>

      <p className="line-clamp-2 text-start text-[13px] text-ink-secondary">{company.tagline}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface">
          {company.sectorLabel}
        </span>
        <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface">
          {company.stageLabel}
        </span>
        <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface">
          {company.countryLabel}
        </span>
        {company.activePitchCount > 0 ? (
          <span className="rounded-pill bg-navy-tint px-2.5 py-1 text-xs font-semibold tabular-nums text-navy">
            {activeCountLabel}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
