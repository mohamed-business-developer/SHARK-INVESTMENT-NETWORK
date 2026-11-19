'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { ButtonSize, ButtonVariant } from '@shark/shared-types';
import { cn } from '@/lib/cn';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly label: string;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-navy text-white border border-transparent hover:bg-navy-hover active:bg-navy-pressed',
  secondary:
    'bg-surface text-navy border-[1.5px] border-navy hover:bg-navy-tint active:bg-navy-tint/80',
  ghost: 'bg-transparent text-navy border border-transparent hover:bg-surfaceSubtle active:bg-line',
  danger:
    'bg-error text-white border border-transparent hover:bg-error-hover active:bg-error-pressed',
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  label,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm px-5 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
        size === 'lg' ? 'min-h-[48px]' : 'min-h-[44px]',
        fullWidth && 'w-full',
        isDisabled && !loading
          ? 'cursor-not-allowed border border-line bg-surfaceSubtle text-ink-surface'
          : VARIANT_CLASSES[variant],
        loading && 'cursor-wait opacity-90',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      <span>{label}</span>
      {!loading ? trailingIcon : null}
    </button>
  );
}
