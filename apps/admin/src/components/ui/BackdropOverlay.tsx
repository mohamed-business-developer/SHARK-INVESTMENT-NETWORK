'use client';

export interface BackdropOverlayProps {
  readonly label: string;
  readonly onClose: () => void;
}

export function BackdropOverlay({ label, onClose }: BackdropOverlayProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClose}
      className="fixed inset-0 cursor-default bg-navy/55"
    />
  );
}
