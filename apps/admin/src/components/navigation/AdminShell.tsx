'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FolderLock,
  Globe,
  LayoutDashboard,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AdminModuleKey } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { cn } from '@/lib/cn';
import { BackdropOverlay } from '@/components/ui';
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from './adminNavConfig';

const MODULE_ICONS: Record<AdminModuleKey, LucideIcon> = {
  'design-system': Palette,
  overview: LayoutDashboard,
  users: Users,
  investors: ShieldCheck,
  companies: Building2,
  verifications: FileCheck2,
  pitches: Briefcase,
  'pitch-reviews': ClipboardCheck,
  documents: FolderLock,
  notifications: Bell,
  'admin-roles': Shield,
  'activity-logs': Activity,
  analytics: BarChart3,
  settings: Settings,
};

export interface AdminShellProps {
  readonly activeModule: AdminModuleKey;
  readonly breadcrumb: string;
  readonly pendingQueueCount?: number;
  readonly children: ReactNode;
}

export function AdminShell({
  activeModule,
  breadcrumb,
  pendingQueueCount = 7,
  children,
}: AdminShellProps) {
  const { locale, t, toggleLocale } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNavContent = (isMobileDrawer: boolean) => {
    const showLabels = isMobileDrawer || !collapsed;

    return (
      <div className="flex h-full flex-col bg-navy text-white">
        <div className="flex min-h-[64px] items-center justify-between gap-2 border-b border-navy-muted px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-navy-muted">
              <ShieldCheck className="h-5 w-5 text-warning" aria-hidden="true" />
            </div>
            {showLabels ? (
              <div className="min-w-0 text-start">
                <p className="truncate text-sm font-bold text-white">{t.navigation.brandTitle}</p>
                <p className="truncate text-[11px] text-navy-tint">{t.navigation.brandSubtitle}</p>
              </div>
            ) : null}
          </div>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.common.close}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-white hover:bg-navy-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <nav
          className="flex-1 space-y-5 overflow-y-auto px-2 py-4"
          aria-label={t.navigation.brandTitle}
        >
          {ADMIN_NAV_GROUPS.map((groupKey) => {
            const items = ADMIN_NAV_ITEMS.filter((item) => item.group === groupKey);
            return (
              <div key={groupKey} className="space-y-1">
                {showLabels ? (
                  <p className="px-3 text-start text-[11px] font-semibold text-navy-tint/80 ltr:uppercase ltr:tracking-wider">
                    {t.navigation.groups[groupKey]}
                  </p>
                ) : null}

                {items.map((item) => {
                  const Icon = MODULE_ICONS[item.key];
                  const isActive = item.key === activeModule;
                  const label = t.navigation.items[item.key];

                  if (!item.implementedInPhase3) {
                    return (
                      <div
                        key={item.key}
                        aria-disabled="true"
                        title={`${label} (${t.navigation.plannedBadge})`}
                        className={cn(
                          'flex min-h-[44px] cursor-not-allowed items-center gap-3 rounded-sm px-3 text-sm text-white/60',
                          !showLabels && 'justify-center px-2',
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {showLabels ? (
                          <span className="min-w-0 flex-1 truncate text-start">{label}</span>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                        isActive
                          ? 'border-s-[3px] border-warning bg-navy-muted font-semibold text-white'
                          : 'text-white/90 hover:bg-navy-muted/60',
                        !showLabels && 'justify-center px-2',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {showLabels ? <span className="truncate text-start">{label}</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-all lg:block',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <BackdropOverlay label={t.common.close} onClose={() => setMobileOpen(false)} />
          <aside className="relative z-10 h-full w-[260px] shadow-modal">
            {renderNavContent(true)}
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t.common.openMenu}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-navy hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={t.common.toggleSidebar}
              className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-navy hover:bg-surfaceSubtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5 rtl:scale-x-[-1]" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-5 w-5 rtl:scale-x-[-1]" aria-hidden="true" />
              )}
            </button>

            <span className="truncate text-start text-sm font-semibold text-ink">{breadcrumb}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t.common.quickSearch}
              className="hidden min-h-[44px] items-center gap-2.5 rounded-sm border border-line bg-canvas px-3 text-xs font-medium text-ink-secondary hover:border-line-hover sm:inline-flex"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">{t.common.quickSearch}</span>
              <kbd
                className="ms-1.5 shrink-0 rounded bg-surfaceSubtle px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-surface"
                dir="ltr"
              >
                ⌘K
              </kbd>
            </button>

            <span className="hidden items-center gap-1.5 rounded-pill border border-warning-border bg-warning-tint px-3 py-1.5 text-xs font-semibold tabular-nums text-warning-text sm:inline-flex">
              <span>{t.common.pendingQueue}</span>
              <span>{pendingQueueCount}</span>
            </span>

            <button
              type="button"
              onClick={() => {
                void toggleLocale();
              }}
              aria-label={t.common.switchLanguage}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-navy bg-surface px-3 text-xs font-semibold text-navy hover:bg-navy-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span>{locale === 'ar' ? t.common.en : t.common.ar}</span>
            </button>

            <span className="hidden rounded-pill bg-navy-tint px-3 py-1.5 text-xs font-semibold text-navy md:inline-flex">
              {t.common.adminRoleBadge}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
