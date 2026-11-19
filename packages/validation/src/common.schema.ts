import { z } from 'zod';
import { LANGUAGE_CODES } from '@shark/shared-types';

export const appLocaleSchema = z.enum(LANGUAGE_CODES, {
  errorMap: () => ({ message: 'validation.locale.invalid' }),
});

export const uuidSchema = z.string().uuid('validation.uuid.invalid');

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{6,14}$/, 'validation.phone.invalidE164');

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'validation.country.invalidIso2');

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'validation.currency.invalidIso3');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'validation.slug.tooShort')
  .max(80, 'validation.slug.tooLong')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'validation.slug.invalidFormat');

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(512, 'validation.url.tooLong')
  .url('validation.url.httpsRequired')
  .refine((val) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(val), 'validation.url.httpsRequired');

/**
 * Strips ASCII control characters while preserving printable Unicode (Arabic & English).
 */
export function sanitizePlainText(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function boundedTextSchema(min: number, max: number, errorPrefix: string) {
  return z
    .string()
    .transform(sanitizePlainText)
    .pipe(z.string().min(min, `${errorPrefix}.tooShort`).max(max, `${errorPrefix}.tooLong`));
}

export const optionalHttpsUrlSchema = httpsUrlSchema.nullable().optional();

export const safeStoragePathSchema = z
  .string()
  .trim()
  .min(5, 'validation.storagePath.invalid')
  .max(300, 'validation.storagePath.tooLong')
  .refine(
    (path) =>
      !path.includes('..') &&
      !path.includes('\\') &&
      !path.includes('\0') &&
      !path.startsWith('/') &&
      !/%2e|%2f|%5c/i.test(path),
    'validation.storagePath.unsafeTraversal',
  );

export const safeRelativeDeepLinkSchema = z
  .string()
  .trim()
  .max(256, 'validation.deepLink.tooLong')
  .refine(
    (val) => val.startsWith('/') && !val.startsWith('//') && !val.includes('..'),
    'validation.deepLink.invalid',
  );
