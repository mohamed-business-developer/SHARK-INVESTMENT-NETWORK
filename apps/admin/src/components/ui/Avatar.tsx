'use client';

import { getInitials } from '@shark/utils';
import { cn } from '@/lib/cn';

export interface AvatarProps {
  readonly name: string;
  readonly imageUrl?: string | null;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly shape?: 'circle' | 'rounded-square';
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const;

export function Avatar({ name, imageUrl, size = 'md', shape = 'circle' }: AvatarProps) {
  const shapeClass = shape === 'circle' ? 'rounded-pill' : 'rounded-sm';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border border-line bg-navy-tint font-bold text-navy',
        SIZE_CLASSES[size],
        shapeClass,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </div>
  );
}
