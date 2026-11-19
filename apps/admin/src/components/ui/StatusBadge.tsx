'use client';

import {
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  FileSearch,
  Lock,
  MinusCircle,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  resolveStatusBadgeTokens,
  type BadgeDomain,
  type BadgeIconKind,
  type BadgeStatus,
} from '@shark/design-tokens';
import { cn } from '@/lib/cn';

export interface StatusBadgeProps {
  readonly domain: BadgeDomain;
  readonly status: BadgeStatus;
  readonly label: string;
  readonly size?: 'sm' | 'md';
}

const BADGE_ICONS: Record<BadgeIconKind, LucideIcon> = {
  'check-circle': CheckCircle2,
  'shield-check': ShieldCheck,
  clock: Clock,
  'file-search': FileSearch,
  'x-circle': XCircle,
  ban: Ban,
  'file-edit': FileEdit,
  'minus-circle': MinusCircle,
  lock: Lock,
};

export function StatusBadge({ domain, status, label, size = 'sm' }: StatusBadgeProps) {
  const tokens = resolveStatusBadgeTokens(domain, status);
  const Icon = BADGE_ICONS[tokens.icon];

  return (
    <span
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        color: tokens.text,
      }}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-pill border py-1 text-xs font-semibold leading-none',
        size === 'md' ? 'px-3' : 'px-2.5',
      )}
    >
      <Icon
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: tokens.iconColor }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
