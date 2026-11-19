import { z } from 'zod';
import { SIGNUP_SELECTABLE_ROLES } from '@shark/shared-types';
import { appLocaleSchema, boundedTextSchema } from './common.schema';

/**
 * Explicitly restricts self-selected signup/onboarding roles to investor | founder | member.
 * 'admin' is unconditionally rejected at the Zod boundary.
 */
export const signupSelectableRoleSchema = z.enum(SIGNUP_SELECTABLE_ROLES, {
  errorMap: () => ({ message: 'validation.auth.invalidSignupRole' }),
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('validation.email.invalid')
  .max(254, 'validation.email.tooLong');

export const passwordPolicySchema = z
  .string()
  .min(10, 'validation.password.minLength')
  .max(128, 'validation.password.maxLength')
  .refine((val) => /[a-zA-Z]/.test(val), 'validation.password.requireLetter')
  .refine((val) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val), {
    message: 'validation.password.requireDigitOrSymbol',
  });

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordPolicySchema,
    fullName: boundedTextSchema(2, 120, 'validation.fullName'),
    preferredLanguage: appLocaleSchema.default('ar'),
    intendedRole: signupSelectableRoleSchema.optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(1, 'validation.password.required')
      .max(128, 'validation.password.maxLength'),
  })
  .strict();

export const selectAccountRoleSchema = z
  .object({
    role: signupSelectableRoleSchema,
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    newPassword: passwordPolicySchema,
  })
  .strict();

export const deleteOwnAccountSchema = z
  .object({
    confirmationPhrase: z.literal('DELETE', {
      errorMap: () => ({ message: 'validation.deleteAccount.phrase' }),
    }),
    currentPassword: z
      .string()
      .min(1, 'validation.password.required')
      .max(128, 'validation.password.maxLength'),
  })
  .strict();
