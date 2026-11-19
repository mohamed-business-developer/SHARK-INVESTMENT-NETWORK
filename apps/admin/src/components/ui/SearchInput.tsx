'use client';

import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface SearchInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly onClear?: () => void;
  readonly filterCount?: number;
  readonly onFilterClick?: () => void;
  readonly loading?: boolean;
  readonly className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  onClear,
  filterCount = 0,
  onFilterClick,
  loading = false,
  className,
}: SearchInputProps) {
  const { t } = useLocale();

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div
      className={cn(
        'flex min-h-[44px] items-center gap-1 rounded-sm border border-line-interactive bg-surface ps-3 pe-1',
        'focus-within:border-info focus-within:ring-2 focus-within:ring-info/20',
        className,
      )}
    >
      <span className="shrink-0 text-ink-secondary">
        {loading ? (
          <Loader2
            className="h-4 w-4 animate-spin text-navy motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Search className="h-5 w-5" aria-hidden="true" />
        )}
      </span>

      <input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-[44px] w-full bg-transparent px-2 text-start text-sm text-ink placeholder:text-ink-secondary focus:outline-none"
      />

      {value.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t.common.clearSearch}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      {onFilterClick ? (
        <button
          type="button"
          onClick={onFilterClick}
          aria-label={t.common.filter}
          className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-navy hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {filterCount > 0 ? (
            <span className="absolute top-1 end-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-navy px-1 text-[11px] font-semibold tabular-nums text-white">
              {filterCount}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
