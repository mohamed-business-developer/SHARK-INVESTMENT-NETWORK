import { z } from 'zod';
import { FUNDING_STAGES, INVESTOR_TYPES, SAVED_ENTITY_TYPES } from '@shark/shared-types';
import {
  appLocaleSchema,
  boundedTextSchema,
  countryCodeSchema,
  currencyCodeSchema,
  e164PhoneSchema,
  optionalHttpsUrlSchema,
  safeStoragePathSchema,
  uuidSchema,
} from './common.schema';

export const notificationPreferencesSchema = z
  .object({
    push: z.boolean(),
    email: z.boolean(),
    announcements: z.boolean(),
  })
  .strict();

/**
 * Strictly excludes privilege columns (role, account_status, approved_*, suspended_*, rejected_*).
 */
export const updateOwnProfileSchema = z
  .object({
    full_name: boundedTextSchema(2, 120, 'validation.fullName').optional(),
    full_name_ar: boundedTextSchema(2, 120, 'validation.fullName').nullable().optional(),
    full_name_en: boundedTextSchema(2, 120, 'validation.fullName').nullable().optional(),
    headline_ar: boundedTextSchema(1, 160, 'validation.headline').nullable().optional(),
    headline_en: boundedTextSchema(1, 160, 'validation.headline').nullable().optional(),
    bio_ar: boundedTextSchema(1, 2000, 'validation.bio').nullable().optional(),
    bio_en: boundedTextSchema(1, 2000, 'validation.bio').nullable().optional(),
    phone: e164PhoneSchema.nullable().optional(),
    avatar_path: safeStoragePathSchema.nullable().optional(),
    country_code: countryCodeSchema.nullable().optional(),
    city_ar: boundedTextSchema(1, 80, 'validation.city').nullable().optional(),
    city_en: boundedTextSchema(1, 80, 'validation.city').nullable().optional(),
    preferred_language: appLocaleSchema.optional(),
    interest_sector_ids: z.array(uuidSchema).max(20, 'validation.sectors.tooMany').optional(),
    notification_preferences: notificationPreferencesSchema.optional(),
    analytics_opt_in: z.boolean().optional(),
  })
  .strict();

export const upsertInvestorProfileSchema = z
  .object({
    investor_type: z.enum(INVESTOR_TYPES, {
      errorMap: () => ({ message: 'validation.investor.invalidType' }),
    }),
    firm_name_ar: boundedTextSchema(1, 120, 'validation.firmName').nullable().optional(),
    firm_name_en: boundedTextSchema(1, 120, 'validation.firmName').nullable().optional(),
    title_ar: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    title_en: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    thesis_ar: boundedTextSchema(1, 2500, 'validation.thesis').nullable().optional(),
    thesis_en: boundedTextSchema(1, 2500, 'validation.thesis').nullable().optional(),
    focus_sector_ids: z.array(uuidSchema).max(20, 'validation.sectors.tooMany').default([]),
    preferred_stages: z.array(z.enum(FUNDING_STAGES)).max(6).default([]),
    ticket_min_usd: z.number().min(0, 'validation.ticket.nonNegative').nullable().optional(),
    ticket_max_usd: z.number().min(0, 'validation.ticket.nonNegative').nullable().optional(),
    currency_code: currencyCodeSchema.default('USD'),
    geography_focus: z
      .array(boundedTextSchema(2, 16, 'validation.geography'))
      .max(25)
      .default([]),
    website_url: optionalHttpsUrlSchema,
    linkedin_url: optionalHttpsUrlSchema,
    is_public_listed: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) =>
      data.ticket_min_usd == null ||
      data.ticket_max_usd == null ||
      data.ticket_max_usd >= data.ticket_min_usd,
    {
      message: 'validation.ticket.maxBelowMin',
      path: ['ticket_max_usd'],
    },
  );

export const upsertFounderProfileSchema = z
  .object({
    job_title_ar: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    job_title_en: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    experience_years: z
      .number()
      .int('validation.experience.integer')
      .min(0)
      .max(70)
      .nullable()
      .optional(),
    previous_exits_count: z.number().int().min(0).max(50).default(0),
    founder_bio_ar: boundedTextSchema(1, 2000, 'validation.bio').nullable().optional(),
    founder_bio_en: boundedTextSchema(1, 2000, 'validation.bio').nullable().optional(),
    linkedin_url: optionalHttpsUrlSchema,
    primary_sector_id: uuidSchema.nullable().optional(),
    is_public_listed: z.boolean().default(true),
  })
  .strict();

export const upsertPortfolioCompanySchema = z
  .object({
    company_id: uuidSchema.nullable().optional(),
    external_name_ar: boundedTextSchema(1, 120, 'validation.companyName').nullable().optional(),
    external_name_en: boundedTextSchema(1, 120, 'validation.companyName').nullable().optional(),
    logo_path: safeStoragePathSchema.nullable().optional(),
    sector_id: uuidSchema.nullable().optional(),
    investment_stage: z.enum(FUNDING_STAGES).nullable().optional(),
    investment_year: z.number().int().min(1970).max(2100).nullable().optional(),
    website_url: optionalHttpsUrlSchema,
    summary_ar: boundedTextSchema(1, 500, 'validation.summary').nullable().optional(),
    summary_en: boundedTextSchema(1, 500, 'validation.summary').nullable().optional(),
    is_exited: z.boolean().default(false),
    is_public: z.boolean().default(true),
    sort_order: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
  .refine(
    (data) =>
      Boolean(data.company_id) ||
      Boolean(data.external_name_ar?.trim()) ||
      Boolean(data.external_name_en?.trim()),
    {
      message: 'validation.portfolio.nameOrCompanyRequired',
    },
  );

export const toggleSavedItemSchema = z
  .object({
    entity_type: z.enum(SAVED_ENTITY_TYPES),
    entity_id: uuidSchema,
    notes: boundedTextSchema(1, 500, 'validation.notes').nullable().optional(),
  })
  .strict();
