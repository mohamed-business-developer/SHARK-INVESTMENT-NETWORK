/**
 * Canonical color palette and semantic color tokens for SHARK Investment Network.
 * Reference: docs/DESIGN_SYSTEM.md Section 2 & Section 7.8
 */

export const BRAND_PRIMARY_NAVY = '#142B49' as const;

export const rawPalette = {
  brand: {
    navy: '#142B49',
    navyHover: '#0F2138',
    navyPressed: '#0A1728',
    navyMuted: '#1E3F6B',
    navyTint: '#E8EEF5',
    navyTintBorder: '#B8C7DC',
  },
  neutral: {
    white: '#FFFFFF',
    lightSurface: '#EDF2F7',
    background: '#F7F9FC',
    textMain: '#172033',
    textSecondary: '#687386',
    textSecondarySurface: '#525D70',
    border: '#E2E8F0',
    borderSubtleHover: '#CBD5E1',
    borderInput: '#808A9D',
    overlay: 'rgba(20, 43, 73, 0.56)',
  },
  status: {
    success: '#16A36A',
    successText: '#0E7048',
    successTint: '#E8F7F0',
    successBorder: '#A3DFC3',
    warning: '#D99A26',
    warningText: '#664400',
    warningIcon: '#8F5E06',
    warningTint: '#FDF5E4',
    warningBorder: '#F2D291',
    error: '#DC3545',
    errorHover: '#B02230',
    errorPressed: '#961B27',
    errorText: '#B02230',
    errorTint: '#FDECEC',
    errorBorder: '#F5B5BC',
    info: '#2878C7',
    infoText: '#1B5A99',
    infoTint: '#EAF3FC',
    infoBorder: '#A9CEF2',
  },
} as const;

export type ColorSchemeMode = 'light' | 'dark';

export interface SemanticColorTokens {
  readonly bg: {
    readonly canvas: string;
    readonly surface: string;
    readonly surfaceElevated: string;
    readonly surfaceSubtle: string;
    readonly surfaceHover: string;
    readonly overlay: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly secondaryOnSubtle: string;
    readonly inverse: string;
    readonly brand: string;
  };
  readonly border: {
    readonly subtle: string;
    readonly hover: string;
    readonly interactive: string;
    readonly focus: string;
  };
  readonly interactive: {
    readonly primary: string;
    readonly primaryHover: string;
    readonly primaryPressed: string;
    readonly primaryTint: string;
    readonly primaryTintPressed: string;
    readonly navActive: string;
    readonly navBorderAccent: string;
  };
  readonly status: {
    readonly success: {
      readonly accent: string;
      readonly text: string;
      readonly tint: string;
      readonly border: string;
    };
    readonly warning: {
      readonly accent: string;
      readonly icon: string;
      readonly text: string;
      readonly tint: string;
      readonly border: string;
    };
    readonly error: {
      readonly fill: string;
      readonly hover: string;
      readonly pressed: string;
      readonly text: string;
      readonly tint: string;
      readonly border: string;
    };
    readonly info: {
      readonly accent: string;
      readonly text: string;
      readonly tint: string;
      readonly border: string;
    };
  };
}

export const lightSemanticColors: SemanticColorTokens = {
  bg: {
    canvas: rawPalette.neutral.background,
    surface: rawPalette.neutral.white,
    surfaceElevated: rawPalette.neutral.white,
    surfaceSubtle: rawPalette.neutral.lightSurface,
    surfaceHover: rawPalette.neutral.background,
    overlay: rawPalette.neutral.overlay,
  },
  text: {
    primary: rawPalette.neutral.textMain,
    secondary: rawPalette.neutral.textSecondary,
    secondaryOnSubtle: rawPalette.neutral.textSecondarySurface,
    inverse: rawPalette.neutral.white,
    brand: rawPalette.brand.navy,
  },
  border: {
    subtle: rawPalette.neutral.border,
    hover: rawPalette.neutral.borderSubtleHover,
    interactive: rawPalette.neutral.borderInput,
    focus: rawPalette.status.info,
  },
  interactive: {
    primary: rawPalette.brand.navy,
    primaryHover: rawPalette.brand.navyHover,
    primaryPressed: rawPalette.brand.navyPressed,
    primaryTint: rawPalette.brand.navyTint,
    primaryTintPressed: '#DCE6F2',
    navActive: rawPalette.brand.navyMuted,
    navBorderAccent: rawPalette.status.warning,
  },
  status: {
    success: {
      accent: rawPalette.status.success,
      text: rawPalette.status.successText,
      tint: rawPalette.status.successTint,
      border: rawPalette.status.successBorder,
    },
    warning: {
      accent: rawPalette.status.warning,
      icon: rawPalette.status.warningIcon,
      text: rawPalette.status.warningText,
      tint: rawPalette.status.warningTint,
      border: rawPalette.status.warningBorder,
    },
    error: {
      fill: rawPalette.status.error,
      hover: rawPalette.status.errorHover,
      pressed: rawPalette.status.errorPressed,
      text: rawPalette.status.errorText,
      tint: rawPalette.status.errorTint,
      border: rawPalette.status.errorBorder,
    },
    info: {
      accent: rawPalette.status.info,
      text: rawPalette.status.infoText,
      tint: rawPalette.status.infoTint,
      border: rawPalette.status.infoBorder,
    },
  },
};

/**
 * Future Dark Mode mapping (v2-ready; v1 defaults strictly to Light Mode).
 */
export const darkSemanticColors: SemanticColorTokens = {
  bg: {
    canvas: '#0B1320',
    surface: '#121E31',
    surfaceElevated: '#18273F',
    surfaceSubtle: '#1E2F4A',
    surfaceHover: '#192942',
    overlay: 'rgba(5, 10, 18, 0.72)',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#A3B1C6',
    secondaryOnSubtle: '#CBD5E1',
    inverse: '#FFFFFF',
    brand: '#93C5FD',
  },
  border: {
    subtle: '#243652',
    hover: '#334B6E',
    interactive: '#64748B',
    focus: '#60A5FA',
  },
  interactive: {
    primary: '#2878C7',
    primaryHover: '#3B82F6',
    primaryPressed: '#1D4ED8',
    primaryTint: 'rgba(40, 120, 199, 0.18)',
    primaryTintPressed: 'rgba(40, 120, 199, 0.28)',
    navActive: '#1E3F6B',
    navBorderAccent: '#FBBF24',
  },
  status: {
    success: {
      accent: '#34D399',
      text: '#6EE7B7',
      tint: 'rgba(22, 163, 106, 0.16)',
      border: '#10B981',
    },
    warning: {
      accent: '#FBBF24',
      icon: '#FDE68A',
      text: '#FDE68A',
      tint: 'rgba(217, 154, 38, 0.16)',
      border: '#D97706',
    },
    error: {
      fill: '#DC3545',
      hover: '#EF4444',
      pressed: '#B91C1C',
      text: '#FCA5A5',
      tint: 'rgba(220, 53, 69, 0.16)',
      border: '#EF4444',
    },
    info: {
      accent: '#60A5FA',
      text: '#93C5FD',
      tint: 'rgba(40, 120, 199, 0.16)',
      border: '#3B82F6',
    },
  },
};

export function getSemanticColors(mode: ColorSchemeMode = 'light'): SemanticColorTokens {
  return mode === 'dark' ? darkSemanticColors : lightSemanticColors;
}

export type BadgeDomain = 'account' | 'company' | 'verification' | 'pitch';

export type BadgeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'unverified'
  | 'verified'
  | 'draft'
  | 'closed'
  | 'restricted';

export type BadgeIconKind =
  | 'check-circle'
  | 'shield-check'
  | 'clock'
  | 'file-search'
  | 'x-circle'
  | 'ban'
  | 'file-edit'
  | 'minus-circle'
  | 'lock';

export interface StatusBadgeTokenSpec {
  readonly background: string;
  readonly border: string;
  readonly text: string;
  readonly iconColor: string;
  readonly icon: BadgeIconKind;
}

/**
 * Resolves exact WCAG AA verified badge styling per domain and status (docs/DESIGN_SYSTEM.md §7.8).
 */
export function resolveStatusBadgeTokens(
  domain: BadgeDomain,
  status: BadgeStatus,
): StatusBadgeTokenSpec {
  if (status === 'approved') {
    return {
      background: rawPalette.status.successTint,
      border: rawPalette.status.successBorder,
      text: rawPalette.status.successText,
      iconColor: rawPalette.status.successText,
      icon: 'check-circle',
    };
  }

  if (status === 'verified') {
    return {
      background: rawPalette.status.successTint,
      border: rawPalette.status.successBorder,
      text: rawPalette.status.successText,
      iconColor: rawPalette.status.successText,
      icon: 'shield-check',
    };
  }

  if (status === 'pending') {
    if (domain === 'company' || domain === 'pitch') {
      return {
        background: rawPalette.status.infoTint,
        border: rawPalette.status.infoBorder,
        text: rawPalette.status.infoText,
        iconColor: rawPalette.status.infoText,
        icon: 'file-search',
      };
    }

    return {
      background: rawPalette.status.warningTint,
      border: rawPalette.status.warningBorder,
      text: rawPalette.status.warningText,
      iconColor: rawPalette.status.warningIcon,
      icon: 'clock',
    };
  }

  if (status === 'rejected') {
    return {
      background: rawPalette.status.errorTint,
      border: rawPalette.status.errorBorder,
      text: rawPalette.status.errorText,
      iconColor: rawPalette.status.errorText,
      icon: 'x-circle',
    };
  }

  if (status === 'suspended') {
    return {
      background: rawPalette.status.errorTint,
      border: rawPalette.status.errorBorder,
      text: rawPalette.status.errorText,
      iconColor: rawPalette.status.errorText,
      icon: 'ban',
    };
  }

  if (status === 'restricted') {
    return {
      background: rawPalette.brand.navyTint,
      border: rawPalette.brand.navyTintBorder,
      text: rawPalette.brand.navy,
      iconColor: rawPalette.brand.navy,
      icon: 'lock',
    };
  }

  if (status === 'draft') {
    return {
      background: rawPalette.neutral.lightSurface,
      border: rawPalette.neutral.borderSubtleHover,
      text: rawPalette.neutral.textSecondarySurface,
      iconColor: rawPalette.neutral.textSecondarySurface,
      icon: 'file-edit',
    };
  }

  return {
    background: rawPalette.neutral.lightSurface,
    border: rawPalette.neutral.borderSubtleHover,
    text: rawPalette.neutral.textSecondarySurface,
    iconColor: rawPalette.neutral.textSecondarySurface,
    icon: 'minus-circle',
  };
}
