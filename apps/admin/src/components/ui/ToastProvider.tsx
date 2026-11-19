'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FeedbackVariant } from '@shark/shared-types';
import { FeedbackBanner } from './FeedbackBanner';

interface ToastItem {
  readonly id: string;
  readonly variant: FeedbackVariant;
  readonly message: string;
}

export interface AdminToastContextValue {
  readonly showToast: (variant: FeedbackVariant, message: string) => void;
  readonly dismissToast: (id: string) => void;
}

const ToastContext = createContext<AdminToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (variant: FeedbackVariant, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-1), { id, variant, message }]);

      if (variant === 'success' || variant === 'info') {
        setTimeout(() => {
          dismissToast(id);
        }, 4000);
      }
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-5 end-5 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto rounded-md shadow-md">
            <FeedbackBanner
              variant={toast.variant}
              message={toast.message}
              onDismiss={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): AdminToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
