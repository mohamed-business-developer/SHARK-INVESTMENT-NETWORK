'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { BackdropOverlay } from './BackdropOverlay';
import { Button } from './Button';
import { TextInput } from './TextInput';

export interface ConfirmationDialogProps {
  readonly open: boolean;
  readonly variant?: 'standard' | 'destructive';
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly requireReasonInput?: boolean;
  readonly reasonLabel?: string;
  readonly reasonPlaceholder?: string;
  readonly loading?: boolean;
  readonly onConfirm: (reason?: string) => void;
  readonly onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  variant = 'standard',
  title,
  description,
  confirmLabel,
  cancelLabel,
  requireReasonInput = false,
  reasonLabel,
  reasonPlaceholder,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const descId = useId();
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const trimmedLength = reason.trim().length;
  const reasonInvalid = requireReasonInput && trimmedLength < 10;

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        setReason('');
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    if (!loading) {
      setReason('');
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (reasonInvalid || loading) {
      return;
    }
    const finalReason = requireReasonInput ? reason.trim() : undefined;
    setReason('');
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <BackdropOverlay label={t.common.close} onClose={handleClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 flex w-full max-w-[440px] flex-col gap-4 rounded-lg bg-surface p-6 text-start shadow-modal focus:outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p id={descId} className="text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>

        {requireReasonInput ? (
          <TextInput
            label={reasonLabel ?? t.dialogs.reasonLabel}
            value={reason}
            onChange={setReason}
            placeholder={reasonPlaceholder ?? t.dialogs.reasonPlaceholder}
            helperText={interpolate(t.dialogs.reasonHint, { count: trimmedLength })}
            multiline
            required
            disabled={loading}
          />
        ) : null}

        <div className="mt-2 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            label={cancelLabel}
            onClick={handleClose}
            disabled={loading}
          />
          <Button
            variant={variant === 'destructive' ? 'danger' : 'primary'}
            label={confirmLabel}
            onClick={handleConfirm}
            disabled={reasonInvalid}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
