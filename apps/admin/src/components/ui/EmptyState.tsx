'use client';

import type { ReactNode } from 'react';
import { Inbox, Lock, Search, WifiOff } from 'lucide-react';
import type { EmptyStateVariant } from '@shark/shared-types';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  readonly variant: EmptyStateVariant;
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly primaryAction?: { readonly label: string; readonly onClick: () => void };
  readonly secondaryAction?: { readonly label: string; readonly onClick: () => void };
}

function DefaultIcon({ variant }: { readonly variant: EmptyStateVariant }) {
  switch (variant) {
    case 'no_search_results':
      return <Search className="h-7 w-7 text-navy" aria-hidden="true" />;
    case 'restricted':
      return <Lock className="h-7 w-7 text-navy" aria-hidden="true" />;
    case 'error':
      return <WifiOff className="h-7 w-7 text-error-text" aria-hidden="true" />;
    default:
      return <Inbox className="h-7 w-7 text-navy" aria-hidden="true" />;
  }
}

export function EmptyState({
  variant,
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const isError = variant === 'error';

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-line bg-surface p-8 text-center">
      <div
        className={cn(
          'mb-1 flex h-16 w-16 items-center justify-center rounded-pill',
          isError ? 'bg-error-tint' : 'bg-navy-tint',
        )}
      >
        {icon ?? <DefaultIcon variant={variant} />}
      </div>

      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-secondary">{description}</p>

      {primaryAction || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            <Button variant="primary" label={primaryAction.label} onClick={primaryAction.onClick} />
          ) : null}
          {secondaryAction ? (
            <Button
              variant="secondary"
              label={secondaryAction.label}
              onClick={secondaryAction.onClick}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
