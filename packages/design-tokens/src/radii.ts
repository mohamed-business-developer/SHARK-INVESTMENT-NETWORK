/**
 * Border Radius Tokens.
 * Reference: docs/DESIGN_SYSTEM.md Section 4.2
 */

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  pill: 9999,
} as const;

export type RadiusToken = keyof typeof radii;
