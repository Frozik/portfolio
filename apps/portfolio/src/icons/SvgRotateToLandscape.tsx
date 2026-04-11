import { memo } from 'react';

export const SvgRotateToLandscape = memo(({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Will switch to landscape mode"
  >
    {/* Phone outline (portrait) */}
    <rect x="7" y="2" width="10" height="20" rx="2" />
    {/* Rotation arrow */}
    <path d="M3 8a9 9 0 0 1 5-5" />
    <path d="M3 8h4V4" />
  </svg>
));
