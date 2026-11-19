import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeedbackVariant } from '@shark/shared-types';
import { mobileTheme } from '@/theme';
import { FeedbackBanner } from './FeedbackBanner';

interface ToastItem {
  readonly id: string;
  readonly variant: FeedbackVariant;
  readonly message: string;
}

export interface ToastContextValue {
  readonly showToast: (variant: FeedbackVariant, message: string) => void;
  readonly dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const insets = useSafeAreaInsets();

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
      {toasts.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { top: insets.top + mobileTheme.space[3] }]}
        >
          {toasts.map((toast) => (
            <View key={toast.id} style={styles.toastShadow}>
              <FeedbackBanner
                variant={toast.variant}
                message={toast.message}
                onDismiss={() => dismissToast(toast.id)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    start: mobileTheme.space[4],
    end: mobileTheme.space[4],
    gap: mobileTheme.space[2],
    zIndex: 100,
  },
  toastShadow: {
    ...mobileTheme.shadows.md.native,
  },
});
