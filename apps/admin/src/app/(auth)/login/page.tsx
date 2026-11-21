import { LoginForm } from '@/components/auth/LoginForm';
import { sanitizeAdminRedirectPath } from '@/lib/auth/origin-and-middleware';

export const dynamic = 'force-dynamic';

interface AdminLoginPageProps {
  readonly searchParams: Promise<{
    readonly next?: string;
    readonly error?: string;
  }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const safeNext = params.next ? sanitizeAdminRedirectPath(params.next, '/') : undefined;
  const envError = params.error === 'env';

  return <LoginForm nextPath={safeNext} envError={envError} />;
}
