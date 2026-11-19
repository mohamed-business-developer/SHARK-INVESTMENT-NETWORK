'use client';

import { ChevronDown, RotateCcw } from 'lucide-react';
import { useLocale } from '@/i18n';
import { Button } from './Button';
import { SearchInput } from './SearchInput';

export interface FilterConfig {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (value: string) => void;
}

export interface FilterBarProps {
  readonly searchQuery: string;
  readonly onSearchChange: (q: string) => void;
  readonly searchPlaceholder: string;
  readonly filters: readonly FilterConfig[];
  readonly activeFilterCount: number;
  readonly onResetAll: () => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilterCount,
  onResetAll,
}: FilterBarProps) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-4">
      <div className="min-w-[240px] flex-1">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          filterCount={activeFilterCount}
        />
      </div>

      {filters.map((filter) => (
        <div key={filter.key} className="relative min-w-[160px]">
          <select
            aria-label={filter.label}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="min-h-[44px] w-full appearance-none rounded-sm border border-line-interactive bg-surface ps-3 pe-9 text-start text-sm font-medium text-ink focus:border-info focus:outline-none focus:ring-2 focus:ring-info/20"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
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
      ))}

      {activeFilterCount > 0 || searchQuery.length > 0 ? (
        <Button
          variant="ghost"
          label={t.common.resetFilters}
          leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          onClick={onResetAll}
        />
      ) : null}
    </div>
  );
}
