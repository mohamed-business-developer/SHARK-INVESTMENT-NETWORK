import { z } from 'zod';
import {
  FUNDING_STAGES,
  INVESTMENT_INSTRUMENTS,
  INVESTOR_TYPES,
  VERIFICATION_BADGE_STATUSES,
} from '@shark/shared-types';
import { boundedTextSchema, countryCodeSchema, uuidSchema } from './common.schema';

export const paginationQuerySchema = z
  .object({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const investorDirectoryFilterSchema = paginationQuerySchema
  .extend({
    q: boundedTextSchema(1, 100, 'validation.search.query').optional(),
    investorType: z.enum(INVESTOR_TYPES).optional(),
    sectorId: uuidSchema.optional(),
    stage: z.enum(FUNDING_STAGES).optional(),
    countryCode: countryCodeSchema.optional(),
    minTicketUsd: z.number().min(0).optional(),
    maxTicketUsd: z.number().min(0).optional(),
    featuredOnly: z.boolean().optional(),
  })
  .strict();

export const companyDirectoryFilterSchema = paginationQuerySchema
  .extend({
    q: boundedTextSchema(1, 100, 'validation.search.query').optional(),
    sectorId: uuidSchema.optional(),
    stage: z.enum(FUNDING_STAGES).optional(),
    countryCode: countryCodeSchema.optional(),
    verificationStatus: z.enum(VERIFICATION_BADGE_STATUSES).optional(),
    featuredOnly: z.boolean().optional(),
  })
  .strict();

export const pitchDirectoryFilterSchema = paginationQuerySchema
  .extend({
    q: boundedTextSchema(1, 100, 'validation.search.query').optional(),
    sectorId: uuidSchema.optional(),
    stage: z.enum(FUNDING_STAGES).optional(),
    instrument: z.enum(INVESTMENT_INSTRUMENTS).optional(),
    minTargetUsd: z.number().min(0).optional(),
    maxTargetUsd: z.number().min(0).optional(),
    featuredOnly: z.boolean().optional(),
  })
  .strict();
