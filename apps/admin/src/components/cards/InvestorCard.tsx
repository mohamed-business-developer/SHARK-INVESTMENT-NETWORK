'use client';

import { Bookmark, ChevronRight } from 'lucide-react';
import type { InvestorCardData } from '@shark/shared-types';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';
import { Avatar, Card, StatusBadge } from '@/components/ui';

export interface InvestorCardProps {
  readonly investor: InvestorCardData;
  readonly onSelect: (id: string) => void;
  readonly onToggleSave?: (id: string) => void;
}

export function InvestorCard({ investor, onSelect, onToggleSave }: InvestorCardProps) {
  const { t } = useLocale();
  const visibleSectors = investor.sectors.slice(0, 3);
  const overflowCount = Math.max(0, investor.sectors.length - 3);

  return (
    <Card className="transition-colors hover:border-line-hover">
      <div className="flex items-center gap-3">
        <Avatar name={investor.fullName} imageUrl={investor.avatarUrl} size="md" shape="circle" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(investor.id)}
              className="truncate text-start text-base font-semibold text-ink hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
            >
              {investor.fullName}
            </button>
            {investor.isVerified ? (
              <StatusBadge
                domain="verification"
                status="verified"
                label={investor.verifiedLabel}
                size="sm"
              />
            ) : null}
          </div>
          <p className="truncate text-[13px] text-ink-secondary">
            {investor.investorTypeLabel} • {investor.countryLabel}
          </p>
        </div>

        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(investor.id)}
            aria-label={investor.isSaved ? t.common.saved : t.common.save}
            aria-pressed={Boolean(investor.isSaved)}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            <Bookmark
              className={cn(
                'h-5 w-5',
                investor.isSaved ? 'fill-navy text-navy' : 'text-ink-secondary',
              )}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <p className="line-clamp-2 text-start text-[13px] text-ink-secondary">{investor.headline}</p>

      <div className="flex flex-col gap-1 rounded-sm border border-line bg-canvas p-3 text-start">
        <span className="text-xs font-medium text-ink-secondary">{investor.ticketLabel}</span>
        <span className="text-lg font-bold tabular-nums text-navy">
          {investor.ticketRangeDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          {visibleSectors.map((sector) => (
            <span
              key={sector}
              className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface"
            >
              {sector}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface tabular-nums">
              {interpolate(t.common.moreCount, { count: overflowCount })}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onSelect(investor.id)}
          aria-label={t.common.viewDetails}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
