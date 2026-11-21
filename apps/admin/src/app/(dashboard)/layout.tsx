import type { ReactNode } from 'react';
import { requireAdminSessionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Admin Gate 2 Dashboard Layout:
 * Enforces verified JWT + approved admin profile + active `admin_roles` on every dashboard render.
 * Phase 6 attaches the 13 governance module pages inside this protected route group.
 */
export default async function ProtectedDashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdminSessionOrRedirect();
  return <>{children}</>;
}
