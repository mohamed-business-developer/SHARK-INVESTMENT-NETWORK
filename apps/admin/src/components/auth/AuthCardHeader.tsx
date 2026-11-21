'use client';

import type { ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface AuthCardHeaderProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly tone?: 'navy' | 'error';
}

export function AuthCardHeader({ icon, title, tone = 'navy' }: AuthCardHeaderProps) {
  const { locale, t, toggleLocale } = useLocale();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className={cn('flex items-center gap-2', tone === 'error' ? 'text-error' : 'text-navy')}>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-sm',
            tone === 'error' ? 'bg-error-tint text-error' : 'bg-navy-tint text-navy',
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            {t.auth.brandBadge}
          </p>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
        </div>
      </div>
      <Button
        variant="ghost"
        size="md"
        label={locale === 'ar' ? t.common.en : t.common.ar}
        leadingIcon={<Globe className="h-4 w-4" aria-hidden="true" />}
        onClick={toggleLocale}
        aria-label={t.common.switchLanguage}
      />
    </div>
  );
}
