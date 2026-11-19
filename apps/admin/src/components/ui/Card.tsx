'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly className?: string;
}

export function Card({ children, onClick, className }: CardProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full flex-col gap-3 rounded-md border border-line bg-surface p-4 text-start transition-colors',
          'hover:border-line-hover hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
          className,
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={cn('flex flex-col gap-3 rounded-md border border-line bg-surface p-4', className)}
    >
      {children}
    </div>
  );
}
