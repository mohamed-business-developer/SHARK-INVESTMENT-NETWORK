'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { loginSchema } from '@shark/validation';
import { adminLoginAction } from '@/actions/auth';
import { Button, Card, FeedbackBanner, TextInput } from '@/components/ui';
import { resolveAdminMessage, useLocale } from '@/i18n';
import { AuthCardHeader } from './AuthCardHeader';

export interface LoginFormProps {
  readonly nextPath?: string;
  readonly envError?: boolean;
}

export function LoginForm({ nextPath, envError = false }: LoginFormProps) {
  const router = useRouter();
  const { locale, t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>(
    envError ? resolveAdminMessage(locale, 'errors.envMisconfigured') : undefined,
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(undefined);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const message = resolveAdminMessage(locale, issue.message);
        if (issue.path[0] === 'email') {
          setEmailError(message);
        } else if (issue.path[0] === 'password') {
          setPasswordError(message);
        } else {
          setFormError(message);
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminLoginAction({
        email: parsed.data.email,
        password: parsed.data.password,
        next: nextPath,
      });

      if (result.ok) {
        router.replace(result.redirectTo ?? '/');
        router.refresh();
        return;
      }

      if (result.redirectTo === '/unauthorized') {
        router.replace('/unauthorized');
        return;
      }

      setFormError(resolveAdminMessage(locale, result.messageKey ?? 'errors.invalidCredentials'));
    } catch {
      setFormError(resolveAdminMessage(locale, 'errors.unexpected'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="gap-5 p-6 shadow-sm">
      <AuthCardHeader
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        title={t.auth.loginTitle}
      />

      <p className="text-start text-sm leading-relaxed text-ink-secondary">
        {t.auth.loginSubtitle}
      </p>

      {formError ? <FeedbackBanner variant="error" message={formError} /> : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextInput
          label={t.auth.emailLabel}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t.auth.emailPlaceholder}
          errorMessage={emailError}
          forceLtrValue
          required
          disabled={submitting}
        />

        <TextInput
          label={t.auth.passwordLabel}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={t.auth.passwordPlaceholder}
          errorMessage={passwordError}
          forceLtrValue
          required
          disabled={submitting}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          leadingIcon={!submitting ? <Lock className="h-4 w-4" aria-hidden="true" /> : undefined}
          label={submitting ? t.auth.submittingLogin : t.auth.submitLogin}
        />
      </form>

      <FeedbackBanner variant="info" message={t.auth.securityNotice} />
    </Card>
  );
}
