import type { AdminModuleKey } from '@shark/shared-types';

export type AdminNavGroupKey = 'core' | 'directory' | 'dealflow' | 'governance' | 'design';

export interface AdminNavItemSpec {
  readonly key: AdminModuleKey;
  readonly href: string;
  readonly group: AdminNavGroupKey;
  readonly implementedInPhase3: boolean;
}

export const ADMIN_NAV_GROUPS: readonly AdminNavGroupKey[] = [
  'design',
  'core',
  'directory',
  'dealflow',
  'governance',
] as const;

export const ADMIN_NAV_ITEMS: readonly AdminNavItemSpec[] = [
  { key: 'design-system', href: '/design-system', group: 'design', implementedInPhase3: true },
  { key: 'overview', href: '/overview', group: 'core', implementedInPhase3: false },
  { key: 'users', href: '/users', group: 'directory', implementedInPhase3: false },
  { key: 'investors', href: '/investors', group: 'directory', implementedInPhase3: false },
  { key: 'companies', href: '/companies', group: 'directory', implementedInPhase3: false },
  { key: 'verifications', href: '/verifications', group: 'directory', implementedInPhase3: false },
  { key: 'pitches', href: '/pitches', group: 'dealflow', implementedInPhase3: false },
  { key: 'pitch-reviews', href: '/pitch-reviews', group: 'dealflow', implementedInPhase3: false },
  { key: 'documents', href: '/documents', group: 'dealflow', implementedInPhase3: false },
  { key: 'notifications', href: '/notifications', group: 'governance', implementedInPhase3: false },
  { key: 'admin-roles', href: '/admin-roles', group: 'governance', implementedInPhase3: false },
  { key: 'activity-logs', href: '/activity-logs', group: 'governance', implementedInPhase3: false },
  { key: 'analytics', href: '/analytics', group: 'governance', implementedInPhase3: false },
  { key: 'settings', href: '/settings', group: 'governance', implementedInPhase3: false },
] as const;
