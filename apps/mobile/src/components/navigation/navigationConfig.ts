import type { MobileTabKey } from '@shark/shared-types';
import type { SharkIconName } from '@/components/ui/Icon';

export interface MobileTabSpec {
  readonly key: MobileTabKey;
  readonly icon: SharkIconName;
  readonly requiresApproval: boolean;
}

/**
 * Canonical 5-tab navigation architecture (start -> end).
 * Renders Right-to-Left in Arabic ('ar') and Left-to-Right in English ('en').
 */
export const MOBILE_TABS: readonly MobileTabSpec[] = [
  { key: 'discovery', icon: 'compass', requiresApproval: false },
  { key: 'investors', icon: 'users', requiresApproval: false },
  { key: 'companies', icon: 'building2', requiresApproval: false },
  { key: 'pitches', icon: 'briefcase', requiresApproval: true },
  { key: 'account', icon: 'user', requiresApproval: false },
] as const;
