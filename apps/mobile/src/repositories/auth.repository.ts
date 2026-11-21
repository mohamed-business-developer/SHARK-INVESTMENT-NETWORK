import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type {
  DeleteOwnAccountRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ProfileRow,
  RegisterRequest,
  ResetPasswordRequest,
  SelectAccountRoleRequest,
} from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  deleteOwnAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  selectAccountRoleSchema,
} from '@shark/validation';
import type { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';

/**
 * Explicit self-profile column projection (never `SELECT *`).
 */
export const PROFILE_SELF_SELECT_COLUMNS = [
  'id',
  'email',
  'phone',
  'full_name',
  'full_name_ar',
  'full_name_en',
  'headline_ar',
  'headline_en',
  'bio_ar',
  'bio_en',
  'avatar_path',
  'country_code',
  'city_ar',
  'city_en',
  'preferred_language',
  'role',
  'account_status',
  'onboarding_completed',
  'onboarding_step',
  'interest_sector_ids',
  'notification_preferences',
  'analytics_opt_in',
  'rejection_reason',
  'suspension_reason',
  'approved_at',
  'approved_by',
  'rejected_at',
  'rejected_by',
  'suspended_at',
  'suspended_by',
  'last_active_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

function validateInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppDomainError({
      code: 'VALIDATION_ERROR',
      messageKey: firstIssue?.message ?? 'errors.validationFailed',
      statusCode: 400,
    });
  }
  return parsed.data;
}

export interface MobileAuthRepository {
  readonly signUp: (
    input: RegisterRequest,
  ) => Promise<{ readonly user: User | null; readonly session: Session | null }>;
  readonly signIn: (
    input: LoginRequest,
  ) => Promise<{ readonly user: User | null; readonly session: Session | null }>;
  readonly signOut: () => Promise<void>;
  readonly getVerifiedUser: () => Promise<User | null>;
  readonly getCurrentSession: () => Promise<Session | null>;
  readonly fetchOwnProfile: (userId: string) => Promise<ProfileRow | null>;
  readonly selectAccountRole: (input: SelectAccountRoleRequest) => Promise<ProfileRow>;
  readonly resetPasswordForEmail: (input: ForgotPasswordRequest) => Promise<void>;
  readonly updatePassword: (input: ResetPasswordRequest) => Promise<User>;
  readonly deleteOwnAccount: (input: DeleteOwnAccountRequest) => Promise<void>;
}

/**
 * Factory creating Mobile Auth repository bound to a concrete anon-key Supabase client.
 */
export function createAuthRepository(client: SupabaseClient): MobileAuthRepository {
  return {
    async signUp(input: RegisterRequest) {
      const valid = validateInput(registerSchema, input);
      return executeServiceCall(async () => {
        const result = await client.auth.signUp({
          email: valid.email,
          password: valid.password,
          options: {
            emailRedirectTo: 'shark://auth/callback',
            data: {
              full_name: valid.fullName,
              preferred_language: valid.preferredLanguage,
              role: valid.intendedRole ?? 'member',
            },
          },
        });
        return assertSupabaseResult(result);
      });
    },

    async signIn(input: LoginRequest) {
      const valid = validateInput(loginSchema, input);
      return executeServiceCall(async () => {
        const result = await client.auth.signInWithPassword({
          email: valid.email,
          password: valid.password,
        });
        return assertSupabaseResult(result);
      });
    },

    async signOut(): Promise<void> {
      try {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          await client
            .from('device_tokens')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('is_active', true);
        }
      } catch {
        // Best-effort push token deactivation must not block local session purge
      }

      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }
    },

    async getVerifiedUser(): Promise<User | null> {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return data.user;
    },

    async getCurrentSession(): Promise<Session | null> {
      const { data, error } = await client.auth.getSession();
      if (error) {
        return null;
      }
      return data.session ?? null;
    },

    async fetchOwnProfile(userId: string): Promise<ProfileRow | null> {
      return executeServiceCall(async () => {
        const result = await client
          .from('profiles')
          .select(PROFILE_SELF_SELECT_COLUMNS)
          .eq('id', userId)
          .is('deleted_at', null)
          .maybeSingle<ProfileRow>();

        return await assertSupabaseResult(result);
      });
    },

    async selectAccountRole(input: SelectAccountRoleRequest): Promise<ProfileRow> {
      const valid = validateInput(selectAccountRoleSchema, input);
      return executeServiceCall(async () => {
        const { data: userData, error: userErr } = await client.auth.getUser();
        if (userErr || !userData.user) {
          throw new AppDomainError({
            code: 'UNAUTHORIZED',
            messageKey: 'errors.unauthorized',
            statusCode: 401,
          });
        }

        const result = await client
          .from('profiles')
          .update({
            role: valid.role,
            onboarding_step: 'profile_setup',
          })
          .eq('id', userData.user.id)
          .eq('account_status', 'pending')
          .eq('onboarding_completed', false)
          .select(PROFILE_SELF_SELECT_COLUMNS)
          .single<ProfileRow>();

        const updated = await assertSupabaseResult(result);
        if (!updated) {
          throw new AppDomainError({
            code: 'NOT_FOUND',
            messageKey: 'errors.profileNotFound',
            statusCode: 404,
          });
        }
        return updated;
      });
    },

    async resetPasswordForEmail(input: ForgotPasswordRequest): Promise<void> {
      const valid = validateInput(forgotPasswordSchema, input);
      await executeServiceCall(async () => {
        const result = await client.auth.resetPasswordForEmail(valid.email, {
          redirectTo: 'shark://auth/reset-password',
        });
        await assertSupabaseResult(result);
      });
    },

    async updatePassword(input: ResetPasswordRequest): Promise<User> {
      const valid = validateInput(resetPasswordSchema, input);
      return executeServiceCall(async () => {
        const result = await client.auth.updateUser({
          password: valid.newPassword,
        });
        const data = await assertSupabaseResult(result);
        if (!data.user) {
          throw new AppDomainError({
            code: 'UNAUTHORIZED',
            messageKey: 'errors.unauthorized',
            statusCode: 401,
          });
        }
        return data.user;
      });
    },

    async deleteOwnAccount(input: DeleteOwnAccountRequest): Promise<void> {
      const valid = validateInput(deleteOwnAccountSchema, input);
      await executeServiceCall(async () => {
        const result = await client.functions.invoke('delete-own-account', {
          body: valid,
        });
        await assertSupabaseResult(result);
      });

      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
  };
}
