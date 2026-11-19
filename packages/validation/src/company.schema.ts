import { z } from 'zod';
import {
  COMPANY_MEMBER_ROLES,
  FUNDING_STAGES,
  TEAM_SIZE_BANDS,
  VERIFICATION_SUBJECT_TYPES,
} from '@shark/shared-types';
import {
  boundedTextSchema,
  countryCodeSchema,
  optionalHttpsUrlSchema,
  safeStoragePathSchema,
  slugSchema,
  uuidSchema,
} from './common.schema';

/**
 * Strictly excludes status, verification_status, is_featured, approved_*, verified_*.
 */
export const upsertCompanySchema = z
  .object({
    slug: slugSchema,
    name_ar: boundedTextSchema(2, 120, 'validation.companyName').nullable().optional(),
    name_en: boundedTextSchema(2, 120, 'validation.companyName').nullable().optional(),
    tagline_ar: boundedTextSchema(2, 180, 'validation.tagline').nullable().optional(),
    tagline_en: boundedTextSchema(2, 180, 'validation.tagline').nullable().optional(),
    description_ar: boundedTextSchema(1, 4000, 'validation.description').nullable().optional(),
    description_en: boundedTextSchema(1, 4000, 'validation.description').nullable().optional(),
    logo_path: safeStoragePathSchema.nullable().optional(),
    banner_path: safeStoragePathSchema.nullable().optional(),
    sector_id: uuidSchema,
    secondary_sector_ids: z.array(uuidSchema).max(5, 'validation.sectors.tooMany').default([]),
    stage: z.enum(FUNDING_STAGES).default('pre_seed'),
    founded_year: z.number().int().min(1900).max(2100).nullable().optional(),
    country_code: countryCodeSchema,
    city_ar: boundedTextSchema(1, 80, 'validation.city').nullable().optional(),
    city_en: boundedTextSchema(1, 80, 'validation.city').nullable().optional(),
    team_size_band: z.enum(TEAM_SIZE_BANDS).nullable().optional(),
    website_url: optionalHttpsUrlSchema,
    linkedin_url: optionalHttpsUrlSchema,
    registration_number: boundedTextSchema(2, 80, 'validation.registrationNumber')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Boolean(data.name_ar?.trim()) || Boolean(data.name_en?.trim()), {
    message: 'validation.company.bilingualNameRequired',
    path: ['name_ar'],
  });

export const inviteCompanyMemberSchema = z
  .object({
    company_id: uuidSchema,
    user_id: uuidSchema,
    member_role: z.enum(COMPANY_MEMBER_ROLES),
    title_ar: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    title_en: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    can_manage_pitches: z.boolean().default(false),
    can_manage_documents: z.boolean().default(false),
  })
  .strict();

export const verificationDocumentItemSchema = z
  .object({
    path: safeStoragePathSchema,
    file_name: boundedTextSchema(1, 255, 'validation.fileName'),
    mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png'], {
      errorMap: () => ({ message: 'validation.document.unsupportedMime' }),
    }),
    file_size_bytes: z
      .number()
      .int()
      .min(1, 'validation.document.emptyFile')
      .max(10_485_760, 'validation.document.maxSize10MB'),
    scan_status: z.enum(['pending']).default('pending'),
  })
  .strict();

export const createVerificationRequestSchema = z
  .object({
    subject_type: z.enum(VERIFICATION_SUBJECT_TYPES),
    company_id: uuidSchema.nullable().optional(),
    document_paths: z
      .array(verificationDocumentItemSchema)
      .min(1, 'validation.verification.documentRequired')
      .max(5, 'validation.verification.tooManyDocuments'),
    submission_notes: boundedTextSchema(1, 1000, 'validation.notes').nullable().optional(),
  })
  .strict()
  .refine((data) => (data.subject_type === 'company_kyb') === Boolean(data.company_id), {
    message: 'validation.verification.companyIdMismatch',
    path: ['company_id'],
  });
