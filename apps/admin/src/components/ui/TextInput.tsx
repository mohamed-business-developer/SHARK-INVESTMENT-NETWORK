'use client';

import { useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly errorMessage?: string;
  readonly required?: boolean;
  readonly type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number';
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly forceLtrValue?: boolean;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly className?: string;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  errorMessage,
  required = false,
  type = 'text',
  multiline = false,
  rows = 4,
  forceLtrValue = false,
  disabled = false,
  maxLength,
  className,
}: TextInputProps) {
  const inputId = useId();
  const feedbackId = useId();
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);

  const hasError = Boolean(errorMessage && errorMessage.trim().length > 0);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;

  const fieldClasses = cn(
    'w-full bg-transparent text-sm text-ink placeholder:text-ink-secondary focus:outline-none',
    'disabled:cursor-not-allowed disabled:text-ink-surface',
    forceLtrValue && 'text-start',
  );

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <label
        htmlFor={inputId}
        className="flex items-center gap-1 text-start text-[13px] font-semibold text-ink"
      >
        <span>{label}</span>
        {required ? (
          <span className="text-error-text" aria-hidden="true">
            {t.common.requiredMark}
          </span>
        ) : null}
      </label>

      <div
        className={cn(
          'flex w-full items-center gap-2 rounded-sm border px-3 transition-colors',
          'focus-within:border-info focus-within:ring-2 focus-within:ring-info/20',
          multiline ? 'min-h-[88px] py-2.5' : 'min-h-[48px]',
          hasError ? 'border-[1.5px] border-error' : 'border-line-interactive',
          disabled ? 'border-line-hover bg-surfaceSubtle' : 'bg-surface',
        )}
      >
        {multiline ? (
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            rows={rows}
            maxLength={maxLength}
            dir={forceLtrValue ? 'ltr' : undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError || helperText ? feedbackId : undefined}
            className={cn(fieldClasses, 'resize-y py-1')}
          />
        ) : (
          <input
            id={inputId}
            type={effectiveType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            dir={forceLtrValue ? 'ltr' : undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError || helperText ? feedbackId : undefined}
            className={cn(fieldClasses, 'min-h-[44px]')}
          />
        )}

        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      {hasError ? (
        <p
          id={feedbackId}
          className="flex items-center gap-1 text-start text-xs font-medium text-error-text"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      ) : helperText ? (
        <p id={feedbackId} className="text-start text-xs text-ink-secondary">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
