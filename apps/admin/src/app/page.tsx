import { DesignSystemShowcase } from '@/components/showcase/DesignSystemShowcase';
import { requireAdminSessionOrRedirect } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireAdminSessionOrRedirect();
  return <DesignSystemShowcase />;
}
