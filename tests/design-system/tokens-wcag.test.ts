import { describe, expect, it } from 'vitest';
import {
  canonicalContrastAuditPairs,
  getContrastRatio,
  meetsWcagAA,
  radii,
  resolveStatusBadgeTokens,
  resolveTypography,
  space,
  typeScale,
  type BadgeDomain,
  type BadgeStatus,
} from '@shark/design-tokens';

describe('@shark/design-tokens WCAG AA & Structural Invariants', () => {
  it('passes WCAG 2.1 AA contrast ratios for every canonical foreground/background pair', () => {
    for (const pair of canonicalContrastAuditPairs) {
      const ratio = getContrastRatio(pair.foreground, pair.background);
      expect(
        meetsWcagAA(pair.foreground, pair.background, pair.kind),
        `Pair "${pair.id}" (${pair.foreground} on ${pair.background}) ratio ${ratio} failed >= ${pair.minimumRatio}`,
      ).toBe(true);
      expect(ratio).toBeGreaterThanOrEqual(pair.minimumRatio);
    }
  });

  it('passes WCAG AA contrast for every domain/status combination in resolveStatusBadgeTokens', () => {
    const cases: Array<[BadgeDomain, BadgeStatus]> = [
      ['account', 'pending'],
      ['account', 'approved'],
      ['account', 'rejected'],
      ['account', 'suspended'],
      ['company', 'draft'],
      ['company', 'pending'],
      ['company', 'approved'],
      ['company', 'rejected'],
      ['company', 'suspended'],
      ['verification', 'unverified'],
      ['verification', 'pending'],
      ['verification', 'verified'],
      ['verification', 'rejected'],
      ['pitch', 'draft'],
      ['pitch', 'pending'],
      ['pitch', 'approved'],
      ['pitch', 'rejected'],
      ['pitch', 'closed'],
      ['pitch', 'restricted'],
    ];

    for (const [domain, status] of cases) {
      const spec = resolveStatusBadgeTokens(domain, status);
      expect(
        meetsWcagAA(spec.text, spec.background, 'normal_text'),
        `StatusBadge (${domain}:${status}) text failed WCAG AA`,
      ).toBe(true);
      expect(
        meetsWcagAA(spec.iconColor, spec.background, 'large_text_or_ui'),
        `StatusBadge (${domain}:${status}) icon failed WCAG AA`,
      ).toBe(true);
    }
  });

  it('enforces Arabic cursive typography rules (letterSpacing = 0, no uppercase, adequate line-height)', () => {
    for (const [name, spec] of Object.entries(typeScale)) {
      expect(spec.letterSpacingAr, `${name} must have letterSpacingAr === 0`).toBe(0);
      expect(spec.lineHeightAr).toBeGreaterThanOrEqual(spec.lineHeightEn);
      const arStyle = resolveTypography(name as keyof typeof typeScale, 'ar');
      expect(arStyle.letterSpacing).toBe(0);
      expect(arStyle.textTransform).toBe('none');
      expect(arStyle.mobileFontFamily).toContain('IBMPlexSansArabic_');
    }
  });

  it('enforces the 4px spacing grid and standard radii', () => {
    for (const [token, value] of Object.entries(space)) {
      expect(value % 4, `space.${token} (${value}) must be a multiple of 4`).toBe(0);
    }
    expect(radii).toEqual({
      none: 0,
      sm: 8,
      md: 12,
      lg: 16,
      pill: 9999,
    });
  });
});
