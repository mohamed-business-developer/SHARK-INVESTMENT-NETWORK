/**
 * 4px Spatial Grid, Touch Target Standards, and Platform Layout Dimensions.
 * Reference: docs/DESIGN_SYSTEM.md Section 4
 */

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type SpaceToken = keyof typeof space;

export const layoutTokens = {
  /** WCAG 2.5.5 minimum interactive target dimension in pt/px. */
  touchTargetMin: 44,
  /** Minimum spacing between sibling interactive controls. */
  adjacentTargetGapMin: 8,
  buttonHeightMd: 44,
  buttonHeightLg: 48,
  inputHeight: 48,
  searchHeight: 44,
  mobileScreenPadding: 16,
  mobileMaxTabletWidth: 600,
  mobileTabBarHeight: 60,
  mobileHeaderHeight: 56,
  adminSidebarExpanded: 260,
  adminSidebarCollapsed: 72,
  adminTopBarHeight: 64,
  adminMaxContainer: 1440,
  adminPageGutter: 24,
  adminPageGutterMobile: 16,
  drawerWidth: 480,
  dialogMaxWidth: 440,
} as const;
