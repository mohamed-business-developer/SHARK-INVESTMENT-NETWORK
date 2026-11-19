'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { FileText, RefreshCw, X } from 'lucide-react';
import { useLocale } from '@/i18n';
import { BackdropOverlay } from './BackdropOverlay';
import { Button } from './Button';
import { FeedbackBanner } from './FeedbackBanner';

export interface SignedDocPreviewModalProps {
  readonly open: boolean;
  readonly fileName: string;
  readonly isExpired?: boolean;
  readonly onRefreshLink?: () => void;
  readonly onClose: () => void;
  readonly previewContent?: ReactNode;
}

export function SignedDocPreviewModal({
  open,
  fileName,
  isExpired = false,
  onRefreshLink,
  onClose,
  previewContent,
}: SignedDocPreviewModalProps) {
  const { t } = useLocale();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <BackdropOverlay label={t.common.close} onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface shadow-modal"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4 text-start">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-ink">
              {t.documents.previewTitle}
            </h2>
            <p className="truncate text-xs text-ink-secondary" dir="ltr">
              {fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <FeedbackBanner variant="info" message={t.documents.securityNotice} />

          {isExpired ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-warning-border bg-warning-tint p-8 text-center">
              <p className="text-base font-semibold text-warning-text">
                {t.documents.expiredTitle}
              </p>
              <p className="max-w-md text-sm text-warning-text">{t.documents.expiredDescription}</p>
              {onRefreshLink ? (
                <Button
                  variant="primary"
                  label={t.documents.refreshLink}
                  leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  onClick={onRefreshLink}
                />
              ) : null}
            </div>
          ) : previewContent ? (
            previewContent
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-interactive bg-canvas p-8 text-center">
              <FileText className="h-10 w-10 text-navy" aria-hidden="true" />
              <p className="max-w-md text-sm text-ink-secondary">{t.documents.placeholderReady}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
