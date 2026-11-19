/**
 * @shark/design-tokens — Complete Framework-Agnostic Design System Tokens
 * Reference: docs/DESIGN_SYSTEM.md
 */

export const DESIGN_TOKENS_VERSION = '1.0.0' as const;

export * from './colors';
export * from './radii';
export * from './shadows';
export * from './spacing';
export * from './typography';
export * from './wcag';

import { lightSemanticColors, rawPalette } from './colors';
import { radii } from './radii';
import { shadows } from './shadows';
import { layoutTokens, space } from './spacing';
import { fontFamilies, typeScale } from './typography';

export const designTokens = {
  version: DESIGN_TOKENS_VERSION,
  palette: rawPalette,
  colors: lightSemanticColors,
  fontFamilies,
  typeScale,
  space,
  layout: layoutTokens,
  radii,
  shadows,
} as const;
