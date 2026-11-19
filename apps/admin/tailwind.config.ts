import type { Config } from 'tailwindcss';
import { fontFamilies, radii, rawPalette, shadows } from '@shark/design-tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: rawPalette.brand.navy,
          hover: rawPalette.brand.navyHover,
          pressed: rawPalette.brand.navyPressed,
          muted: rawPalette.brand.navyMuted,
          tint: rawPalette.brand.navyTint,
          border: rawPalette.brand.navyTintBorder,
        },
        canvas: rawPalette.neutral.background,
        surface: rawPalette.neutral.white,
        surfaceSubtle: rawPalette.neutral.lightSurface,
        ink: {
          DEFAULT: rawPalette.neutral.textMain,
          secondary: rawPalette.neutral.textSecondary,
          surface: rawPalette.neutral.textSecondarySurface,
        },
        line: {
          DEFAULT: rawPalette.neutral.border,
          hover: rawPalette.neutral.borderSubtleHover,
          interactive: rawPalette.neutral.borderInput,
        },
        success: {
          DEFAULT: rawPalette.status.success,
          text: rawPalette.status.successText,
          tint: rawPalette.status.successTint,
          border: rawPalette.status.successBorder,
        },
        warning: {
          DEFAULT: rawPalette.status.warning,
          text: rawPalette.status.warningText,
          icon: rawPalette.status.warningIcon,
          tint: rawPalette.status.warningTint,
          border: rawPalette.status.warningBorder,
        },
        error: {
          DEFAULT: rawPalette.status.error,
          hover: rawPalette.status.errorHover,
          pressed: rawPalette.status.errorPressed,
          text: rawPalette.status.errorText,
          tint: rawPalette.status.errorTint,
          border: rawPalette.status.errorBorder,
        },
        info: {
          DEFAULT: rawPalette.status.info,
          text: rawPalette.status.infoText,
          tint: rawPalette.status.infoTint,
          border: rawPalette.status.infoBorder,
        },
      },
      borderRadius: {
        none: `${radii.none}px`,
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        pill: `${radii.pill}px`,
      },
      boxShadow: {
        none: shadows.none.webBoxShadow,
        xs: shadows.xs.webBoxShadow,
        sm: shadows.sm.webBoxShadow,
        md: shadows.md.webBoxShadow,
        modal: shadows.modal.webBoxShadow,
      },
      fontFamily: {
        arabic: [fontFamilies.web.ar],
        sans: [fontFamilies.web.en],
        mono: [fontFamilies.web.mono],
      },
    },
  },
  plugins: [],
};

export default config;
