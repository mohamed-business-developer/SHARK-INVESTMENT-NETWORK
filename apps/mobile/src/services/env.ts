import { z } from 'zod';
import { appLocaleSchema } from '@shark/validation';

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  EXPO_PUBLIC_DEFAULT_LOCALE: appLocaleSchema.default('ar'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
  EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
  EXPO_PUBLIC_POSTHOG_HOST: z.string().default('https://eu.i.posthog.com'),
  EXPO_PUBLIC_EAS_PROJECT_ID: z.string().optional(),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

/**
 * Accesses EXPO_PUBLIC_* statically so Metro inline replacement works at bundle time.
 */
export const mobileEnv: MobileEnv = mobileEnvSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_DEFAULT_LOCALE: process.env.EXPO_PUBLIC_DEFAULT_LOCALE,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_POSTHOG_API_KEY: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
  EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
});
