import { cookies } from 'next/headers';
import type { AppLocale } from '@shark/shared-types';
import { LOCALE_STORAGE_KEY, parseLocale } from '@shark/utils';
import { publicAdminEnv } from '@/lib/env';

export async function resolveServerLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  return parseLocale(stored, publicAdminEnv.NEXT_PUBLIC_DEFAULT_LOCALE);
}
