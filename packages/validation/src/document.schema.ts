import { z } from 'zod';
import { PITCH_DOCUMENT_CATEGORIES } from '@shark/shared-types';
import { boundedTextSchema, safeStoragePathSchema, uuidSchema } from './common.schema';

export const ALLOWED_PUBLIC_ASSET_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ALLOWED_PITCH_DOCUMENT_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const;

export const ALLOWED_VERIFICATION_DOCUMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_PUBLIC_ASSET_BYTES = 5 * 1024 * 1024;
export const MAX_VERIFICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_PITCH_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const PITCH_STORAGE_PATH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|pptx|xlsx|png|jpg|jpeg)$/i;

export const createPitchDocumentSchema = z
  .object({
    pitch_id: uuidSchema,
    company_id: uuidSchema,
    category: z.enum(PITCH_DOCUMENT_CATEGORIES),
    title_ar: boundedTextSchema(1, 160, 'validation.document.title').nullable().optional(),
    title_en: boundedTextSchema(1, 160, 'validation.document.title').nullable().optional(),
    file_name: boundedTextSchema(1, 255, 'validation.fileName').refine(
      (name) => !name.includes('/') && !name.includes('\\'),
      'validation.fileName.noSeparators',
    ),
    storage_path: safeStoragePathSchema.refine(
      (p) => PITCH_STORAGE_PATH_REGEX.test(p),
      'validation.document.invalidCanonicalPath',
    ),
    mime_type: z.enum(ALLOWED_PITCH_DOCUMENT_MIMES, {
      errorMap: () => ({ message: 'validation.document.unsupportedMime' }),
    }),
    file_size_bytes: z
      .number()
      .int()
      .min(1, 'validation.document.emptyFile')
      .max(MAX_PITCH_DOCUMENT_BYTES, 'validation.document.maxSize25MB'),
    checksum_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'validation.document.invalidChecksum')
      .nullable()
      .optional(),
    sort_order: z.number().int().min(0).max(500).default(0),
  })
  .strict();

export const getSignedDocumentUrlSchema = z
  .object({
    bucket: z.enum(['pitch-documents', 'verification-documents'], {
      errorMap: () => ({ message: 'validation.document.invalidBucket' }),
    }),
    documentId: uuidSchema,
    storagePath: safeStoragePathSchema.optional(),
  })
  .strict();
