'use client';

import { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly errorMessage?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  errorMessage,
  required = false,
  disabled = false,
  className,
}: SelectProps) {
  const selectId = useId();
  const { t } = useLocale();
  const hasError = Boolean(errorMessage && errorMessage.trim().length > 0);

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <label
        htmlFor={selectId}
        className="flex items-center gap-1 text-start text-[13px] font-semibold text-ink"
      >
        <span>{label}</span>
        {required ? (
          <span className="text-error-text" aria-hidden="true">
            {t.common.requiredMark}
          </span>
        ) : null}
      </label>

      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={hasError || undefined}
          className={cn(
            'min-h-[48px] w-full appearance-none rounded-sm border bg-surface ps-3 pe-10 text-start text-sm text-ink transition-colors',
            'focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20',
            'disabled:cursor-not-allowed disabled:border-line-hover disabled:bg-surfaceSubtle disabled:text-ink-surface',
            hasError ? 'border-[1.5px] border-error' : 'border-line-interactive',
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute top-1/2 end-3 h-4 w-4 -translate-y-1/2 text-ink-secondary"
          aria-hidden="true"
        />
      </div>

      {hasError ? (
        <p className="flex items-center gap-1 text-start text-xs font-medium text-error-text">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
