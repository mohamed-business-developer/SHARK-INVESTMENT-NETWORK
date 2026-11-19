/**
 * Corporate Minimal Elevation & Shadow Tokens (Web CSS + React Native).
 * Reference: docs/DESIGN_SYSTEM.md Section 4.3
 */

export interface NativeShadowSpec {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

export interface ElevationSpec {
  readonly webBoxShadow: string;
  readonly native: NativeShadowSpec;
}

export const shadows = {
  none: {
    webBoxShadow: 'none',
    native: {
      shadowColor: '#142B49',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  xs: {
    webBoxShadow: '0 1px 2px rgba(20, 43, 73, 0.04)',
    native: {
      shadowColor: '#142B49',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  sm: {
    webBoxShadow: '0 4px 12px rgba(20, 43, 73, 0.07)',
    native: {
      shadowColor: '#142B49',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
  },
  md: {
    webBoxShadow: '0 10px 24px rgba(20, 43, 73, 0.12)',
    native: {
      shadowColor: '#142B49',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  modal: {
    webBoxShadow: '0 20px 40px rgba(20, 43, 73, 0.18)',
    native: {
      shadowColor: '#142B49',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 12,
    },
  },
} as const satisfies Record<string, ElevationSpec>;

export type ShadowToken = keyof typeof shadows;
