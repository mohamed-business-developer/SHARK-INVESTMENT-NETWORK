'use client';

import type { LoadingSkeletonPreset } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface LoadingSkeletonProps {
  readonly preset: LoadingSkeletonPreset;
  readonly count?: number;
}

export function LoadingSkeleton({ preset, count }: LoadingSkeletonProps) {
  const { t } = useLocale();
  const itemCount = count ?? (preset === 'table_rows' ? 6 : 3);
  const items = Array.from({ length: itemCount }, (_, idx) => idx);

  if (preset === 'table_rows') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        aria-label={t.common.loading}
        className="overflow-hidden rounded-md border border-line bg-surface"
      >
        <div className="h-11 border-b border-line bg-surfaceSubtle" aria-hidden="true" />
        <div className="divide-y divide-line" aria-hidden="true">
          {items.map((idx) => (
            <div key={idx} className="flex min-h-[56px] items-center gap-4 px-4">
              <div className="h-8 w-8 animate-pulse rounded-pill bg-surfaceSubtle motion-reduce:animate-none" />
              <div className="h-4 w-1/4 animate-pulse rounded-sm bg-surfaceSubtle motion-reduce:animate-none" />
              <div className="h-4 w-1/5 animate-pulse rounded-sm bg-surfaceSubtle motion-reduce:animate-none" />
              <div className="ms-auto h-6 w-20 animate-pulse rounded-pill bg-surfaceSubtle motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={t.common.loading}
      className={cn(
        'grid gap-4',
        preset === 'profile_header' || preset === 'detail_page'
          ? 'grid-cols-1'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {items.map((idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 shrink-0 animate-pulse bg-surfaceSubtle motion-reduce:animate-none',
                preset === 'company_card' ? 'rounded-sm' : 'rounded-pill',
              )}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surfaceSubtle motion-reduce:animate-none" />
              <div className="h-3 w-1/2 animate-pulse rounded-sm bg-surfaceSubtle motion-reduce:animate-none" />
            </div>
          </div>
          <div className="h-11 w-full animate-pulse rounded-sm bg-surfaceSubtle motion-reduce:animate-none" />
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-pill bg-surfaceSubtle motion-reduce:animate-none" />
            <div className="h-6 w-24 animate-pulse rounded-pill bg-surfaceSubtle motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
