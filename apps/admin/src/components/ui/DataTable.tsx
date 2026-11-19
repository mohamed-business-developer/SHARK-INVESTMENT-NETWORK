'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';

export interface DataTableColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly align?: 'start' | 'end';
  readonly render: (row: T) => ReactNode;
}

export interface DataTableRowAction<T> {
  readonly key: string;
  readonly label: string;
  readonly destructive?: boolean;
  readonly onClick: (row: T) => void;
}

export interface DataTableProps<T> {
  readonly rows: readonly T[];
  readonly columns: readonly DataTableColumn<T>[];
  readonly getRowKey: (row: T) => string;
  readonly rowActions?: readonly DataTableRowAction<T>[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: 20 | 50;
  readonly onPageChange: (nextPage: number) => void;
  readonly onPageSizeChange: (nextSize: 20 | 50) => void;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  rowActions,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  const { t } = useLocale();
  const [openMenuRowKey, setOpenMenuRowKey] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="h-11 border-b border-line bg-surfaceSubtle text-xs font-semibold text-ink-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2 font-semibold',
                    col.align === 'end' ? 'text-end' : 'text-start',
                  )}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && rowActions.length > 0 ? (
                <th scope="col" className="w-16 px-4 py-2 text-end font-semibold">
                  {t.common.actions}
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const rowKey = getRowKey(row);
              const menuOpen = openMenuRowKey === rowKey;

              return (
                <tr key={rowKey} className="min-h-[56px] transition-colors hover:bg-canvas">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-ink',
                        col.align === 'end' ? 'text-end tabular-nums' : 'text-start',
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions && rowActions.length > 0 ? (
                    <td className="relative px-4 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => setOpenMenuRowKey(menuOpen ? null : rowKey)}
                        aria-label={t.common.actions}
                        aria-expanded={menuOpen}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-ink-secondary hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                      >
                        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                      </button>

                      {menuOpen ? (
                        <div className="absolute top-12 end-4 z-20 min-w-[180px] rounded-sm border border-line bg-surface p-1 shadow-sm">
                          {rowActions.map((action) => (
                            <button
                              key={action.key}
                              type="button"
                              onClick={() => {
                                setOpenMenuRowKey(null);
                                action.onClick(row);
                              }}
                              className={cn(
                                'flex min-h-[44px] w-full items-center rounded-sm px-3 text-start text-sm font-medium hover:bg-surfaceSubtle',
                                action.destructive ? 'text-error-text' : 'text-ink',
                              )}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 text-xs text-ink-secondary">
        <span className="tabular-nums">
          {interpolate(t.common.showingRange, { from, to, total: totalCount })}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span>{t.common.rowsPerPage}</span>
            <div className="relative">
              <select
                aria-label={t.common.rowsPerPage}
                value={String(pageSize)}
                onChange={(e) => onPageSizeChange(Number(e.target.value) === 50 ? 50 : 20)}
                className="min-h-[44px] appearance-none rounded-sm border border-line-interactive bg-surface ps-3 pe-8 text-xs font-medium text-ink tabular-nums focus:border-info focus:outline-none"
              >
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 end-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-line bg-surface px-3 text-xs font-semibold text-navy hover:bg-surfaceSubtle disabled:cursor-not-allowed disabled:bg-surfaceSubtle disabled:text-ink-surface"
            >
              <ChevronLeft className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              <span>{t.common.previous}</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-sm border border-line bg-surface px-3 text-xs font-semibold text-navy hover:bg-surfaceSubtle disabled:cursor-not-allowed disabled:bg-surfaceSubtle disabled:text-ink-surface"
            >
              <span>{t.common.next}</span>
              <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
