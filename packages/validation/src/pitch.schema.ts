import { z } from 'zod';
import {
  FUNDING_STAGES,
  INVESTMENT_INSTRUMENTS,
  INVESTMENT_INTEREST_STATUSES,
} from '@shark/shared-types';
import { boundedTextSchema, currencyCodeSchema, uuidSchema } from './common.schema';

/**
 * Founder-editable pitch payload; strictly blocks status jumps, is_featured, approved_*, restricted_*.
 */
export const upsertPitchSchema = z
  .object({
    company_id: uuidSchema,
    sector_id: uuidSchema,
    title_ar: boundedTextSchema(2, 160, 'validation.pitch.title').nullable().optional(),
    title_en: boundedTextSchema(2, 160, 'validation.pitch.title').nullable().optional(),
    summary_ar: boundedTextSchema(1, 600, 'validation.pitch.summary').nullable().optional(),
    summary_en: boundedTextSchema(1, 600, 'validation.pitch.summary').nullable().optional(),
    problem_ar: boundedTextSchema(1, 3000, 'validation.pitch.section').nullable().optional(),
    problem_en: boundedTextSchema(1, 3000, 'validation.pitch.section').nullable().optional(),
    solution_ar: boundedTextSchema(1, 3000, 'validation.pitch.section').nullable().optional(),
    solution_en: boundedTextSchema(1, 3000, 'validation.pitch.section').nullable().optional(),
    market_opportunity_ar: boundedTextSchema(1, 3000, 'validation.pitch.section')
      .nullable()
      .optional(),
    market_opportunity_en: boundedTextSchema(1, 3000, 'validation.pitch.section')
      .nullable()
      .optional(),
    traction_metrics: z
      .record(z.string().max(64), z.union([z.string().max(120), z.number(), z.boolean(), z.null()]))
      .default({}),
    use_of_funds_ar: boundedTextSchema(1, 2000, 'validation.pitch.section').nullable().optional(),
    use_of_funds_en: boundedTextSchema(1, 2000, 'validation.pitch.section').nullable().optional(),
    funding_stage: z.enum(FUNDING_STAGES),
    instrument: z.enum(INVESTMENT_INSTRUMENTS).default('equity'),
    target_amount_usd: z.number().positive('validation.pitch.raisePositive').max(1_000_000_000),
    min_ticket_usd: z.number().positive('validation.pitch.ticketPositive').nullable().optional(),
    pre_money_valuation_usd: z
      .number()
      .positive('validation.pitch.valuationPositive')
      .nullable()
      .optional(),
    equity_offered_pct: z
      .number()
      .gt(0, 'validation.pitch.equityPositive')
      .lte(100, 'validation.pitch.equityMax100')
      .nullable()
      .optional(),
    currency_code: currencyCodeSchema.default('USD'),
    closing_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date.invalidIsoDate')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Boolean(data.title_ar?.trim()) || Boolean(data.title_en?.trim()), {
    message: 'validation.pitch.bilingualTitleRequired',
    path: ['title_ar'],
  })
  .refine((data) => data.min_ticket_usd == null || data.min_ticket_usd <= data.target_amount_usd, {
    message: 'validation.pitch.minTicketExceedsTarget',
    path: ['min_ticket_usd'],
  });

export const founderPitchTransitionSchema = z
  .object({
    pitch_id: uuidSchema,
    next_status: z.enum(['pending', 'closed'], {
      errorMap: () => ({ message: 'validation.pitch.invalidFounderTransition' }),
    }),
  })
  .strict();

export const createInvestmentInterestSchema = z
  .object({
    pitch_id: uuidSchema,
    indicative_amount_usd: z
      .number()
      .positive('validation.interest.amountPositive')
      .max(1_000_000_000)
      .nullable()
      .optional(),
    message: boundedTextSchema(1, 2000, 'validation.interest.message').nullable().optional(),
  })
  .strict();

export const updateInvestmentInterestResponseSchema = z
  .object({
    interest_id: uuidSchema,
    status: z.enum(INVESTMENT_INTEREST_STATUSES),
    founder_notes: boundedTextSchema(1, 1000, 'validation.notes').nullable().optional(),
  })
  .strict();
