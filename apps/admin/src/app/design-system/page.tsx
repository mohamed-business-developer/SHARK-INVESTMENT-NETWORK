import { DesignSystemShowcase } from '@/components/showcase/DesignSystemShowcase';
import { requireAdminSessionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    await requireAdminSessionOrRedirect();
  }
  return <DesignSystemShowcase />;
}
