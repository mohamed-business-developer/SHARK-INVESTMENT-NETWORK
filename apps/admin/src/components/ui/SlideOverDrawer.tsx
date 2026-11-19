'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '@/i18n';
import { BackdropOverlay } from './BackdropOverlay';

export interface SlideOverDrawerProps {
  readonly open: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function SlideOverDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: SlideOverDrawerProps) {
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
    <div className="fixed inset-0 z-40 flex justify-end">
      <BackdropOverlay label={t.common.close} onClose={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-[480px] flex-col border-s border-line bg-surface shadow-modal"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-4 text-start">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-lg font-semibold text-ink">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-ink-secondary">{subtitle}</p> : null}
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

        <div className="flex-1 overflow-y-auto p-6 text-start">{children}</div>

        {footer ? (
          <footer className="border-t border-line bg-canvas px-6 py-4">{footer}</footer>
        ) : null}
      </aside>
    </div>
  );
}
