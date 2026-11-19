'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { FeedbackVariant } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface FeedbackBannerProps {
  readonly variant: FeedbackVariant;
  readonly message: string;
  readonly title?: string;
  readonly onDismiss?: () => void;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

const VARIANT_MAP = {
  info: {
    box: 'bg-info-tint border-info-border text-info-text',
    iconColor: 'text-info-text',
    Icon: Info,
  },
  success: {
    box: 'bg-success-tint border-success-border text-success-text',
    iconColor: 'text-success-text',
    Icon: CheckCircle2,
  },
  warning: {
    box: 'bg-warning-tint border-warning-border text-warning-text',
    iconColor: 'text-warning-icon',
    Icon: AlertTriangle,
  },
  error: {
    box: 'bg-error-tint border-error-border text-error-text',
    iconColor: 'text-error-text',
    Icon: AlertCircle,
  },
} as const;

export function FeedbackBanner({
  variant,
  message,
  title,
  onDismiss,
  action,
}: FeedbackBannerProps) {
  const { t } = useLocale();
  const { box, iconColor, Icon } = VARIANT_MAP[variant];

  return (
    <div
      role="alert"
      className={cn('flex items-start gap-2.5 rounded-sm border p-3 text-start', box)}
    >
      <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', iconColor)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="text-[13px] font-semibold">{title}</p> : null}
        <p className="text-[13px] leading-relaxed">{message}</p>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex min-h-[44px] w-fit items-center text-xs font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.common.dismiss}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
