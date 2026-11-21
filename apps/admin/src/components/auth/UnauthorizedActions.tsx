'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldAlert } from 'lucide-react';
import { adminLogoutAction } from '@/actions/auth';
import { Button, Card, FeedbackBanner } from '@/components/ui';
import { useLocale } from '@/i18n';
import { AuthCardHeader } from './AuthCardHeader';

export function UnauthorizedActions() {
  const router = useRouter();
  const { t } = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutAndReturn = async () => {
    setSigningOut(true);
    try {
      await adminLogoutAction();
    } finally {
      setSigningOut(false);
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <Card className="gap-5 p-6 shadow-sm">
      <AuthCardHeader
        icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        title={t.auth.unauthorizedTitle}
        tone="error"
      />

      <p className="text-start text-sm leading-relaxed text-ink-secondary">
        {t.auth.unauthorizedSubtitle}
      </p>

      <FeedbackBanner variant="error" message={t.auth.unauthorizedBanner} />

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={signingOut}
          leadingIcon={!signingOut ? <LogOut className="h-4 w-4" aria-hidden="true" /> : undefined}
          label={t.auth.signOutAndReturn}
          onClick={handleSignOutAndReturn}
        />
      </div>
    </Card>
  );
}
