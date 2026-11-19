'use client';

import { ChevronRight, Lock } from 'lucide-react';
import type { PitchCardData } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { Avatar, Card, StatusBadge } from '@/components/ui';

export interface PitchCardProps {
  readonly pitch: PitchCardData;
  readonly targetLabel: string;
  readonly equityLabel: string;
  readonly onSelect: (id: string) => void;
  readonly onRequestAccess?: (id: string) => void;
}

export function PitchCard({
  pitch,
  targetLabel,
  equityLabel,
  onSelect,
  onRequestAccess,
}: PitchCardProps) {
  const { t } = useLocale();
  const isRestrictedLocked = pitch.accessMode === 'restricted_locked';

  const handleAction = () => {
    if (isRestrictedLocked && onRequestAccess) {
      onRequestAccess(pitch.id);
      return;
    }
    onSelect(pitch.id);
  };

  return (
    <Card onClick={handleAction}>
      <div className="flex w-full items-center gap-2">
        <Avatar
          name={pitch.companyName}
          imageUrl={pitch.companyLogoUrl}
          size="sm"
          shape="rounded-square"
        />
        <span className="min-w-0 flex-1 truncate text-start text-[13px] text-ink-secondary">
          {pitch.companyName}
        </span>
        <StatusBadge
          domain="pitch"
          status={pitch.pitchStatus}
          label={pitch.statusLabel}
          size="sm"
        />
      </div>

      <div className="flex flex-col gap-1 text-start">
        <h3 className="line-clamp-2 text-base font-semibold text-ink">{pitch.title}</h3>
        <p className="line-clamp-2 text-[13px] text-ink-secondary">{pitch.summaryTeaser}</p>
      </div>

      {isRestrictedLocked ? (
        <div className="relative flex min-h-[84px] w-full items-center justify-center rounded-sm border border-dashed border-line-interactive bg-surfaceSubtle p-4">
          <div className="flex w-full flex-col gap-2 opacity-40" aria-hidden="true">
            <div className="h-3 w-3/5 rounded-sm bg-line-hover" />
            <div className="h-3 w-2/5 rounded-sm bg-line-hover" />
          </div>
          <div className="absolute inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-navy shadow-xs">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.states.restrictedOverlayLabel}</span>
          </div>
        </div>
      ) : (
        <div className="grid w-full grid-cols-2 divide-x divide-line rounded-sm border border-line bg-canvas p-3 text-start rtl:divide-x-reverse">
          <div className="flex flex-col gap-1 pe-3">
            <span className="text-xs font-medium text-ink-secondary">{targetLabel}</span>
            <span className="text-lg font-bold tabular-nums text-navy">
              {pitch.targetAmountDisplay}
            </span>
          </div>
          <div className="flex flex-col gap-1 ps-3">
            <span className="text-xs font-medium text-ink-secondary">{equityLabel}</span>
            <span className="text-lg font-bold tabular-nums text-ink">
              {pitch.equityOfferedDisplay ?? '—'}
            </span>
          </div>
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface">
            {pitch.sectorLabel}
          </span>
          <span className="rounded-pill bg-surfaceSubtle px-2.5 py-1 text-xs font-medium text-ink-surface">
            {pitch.stageLabel}
          </span>
          {!isRestrictedLocked && pitch.hasDeckDocument ? (
            <span className="rounded-pill bg-info-tint px-2.5 py-1 text-xs font-semibold text-info-text">
              {t.common.deckAttached}
            </span>
          ) : null}
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ink-secondary rtl:scale-x-[-1]"
          aria-hidden="true"
        />
      </div>
    </Card>
  );
}
