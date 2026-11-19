/**
 * @shark/validation — Strict Zod Boundary Validation Schemas
 * Reference: docs/SECURITY.md §7.1 & docs/ARCHITECTURE.md §9
 */

export const VALIDATION_VERSION = '1.0.0' as const;

export * from './admin.schema';
export * from './auth.schema';
export * from './common.schema';
export * from './company.schema';
export * from './document.schema';
export * from './env.schema';
export * from './pitch.schema';
export * from './profile.schema';
export * from './search.schema';
