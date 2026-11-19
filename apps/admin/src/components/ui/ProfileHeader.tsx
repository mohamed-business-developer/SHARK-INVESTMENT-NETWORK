'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
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
  const isNavy = variant === 'navy';
  const clamped =
    typeof completenessPercent === 'number'
      ? Math.max(0, Math.min(100, completenessPercent))
      : undefined;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md border p-5',
        isNavy ? 'border-navy-muted bg-navy text-white' : 'border-line bg-surface text-ink',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={name} imageUrl={avatarUrl} size="lg" shape={avatarShape} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-start">
            <h2 className="truncate text-xl font-semibold">{name}</h2>
            <p className={cn('text-[13px]', isNavy ? 'text-navy-tint' : 'text-ink-secondary')}>
              {subtitle}
            </p>
            {badges.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {badges.slice(0, 2).map((badge) => (
                  <StatusBadge key={`${badge.domain}-${badge.status}-${badge.label}`} {...badge} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {actionSlot ? <div className="shrink-0">{actionSlot}</div> : null}
      </div>

      {typeof clamped === 'number' ? (
        <div
          className={cn(
            'h-1.5 w-full overflow-hidden rounded-pill',
            isNavy ? 'bg-navy-muted' : 'bg-surfaceSubtle',
          )}
        >
          <div
            className="h-full rounded-pill bg-success transition-all"
            style={{ width: `${clamped}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
