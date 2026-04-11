import { memo } from 'react';

export const SvgRotateToLandscape = memo(({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className}>
    {/* Phone body (portrait) */}
    <rect
      x="12"
      y="4"
      width="26"
      height="46"
      rx="4"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Phone screen */}
    <rect x="15" y="10" width="20" height="30" rx="1" stroke="currentColor" strokeWidth="1.5" />
    {/* Speaker */}
    <line
      x1="22"
      y1="7.5"
      x2="28"
      y2="7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Camera dot */}
    <circle cx="20" cy="7.5" r="1" fill="currentColor" />
    {/* Home button */}
    <circle cx="25" cy="45" r="2.5" stroke="currentColor" strokeWidth="1.5" />

    {/* Dashed landscape phone outline (rotated) */}
    <rect
      x="33"
      y="30"
      width="26"
      height="16"
      rx="3"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeDasharray="4 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Dashed phone right side with "button" area */}
    <line
      x1="53"
      y1="32"
      x2="53"
      y2="44"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="3 2"
    />

    {/* Rotation arrow */}
    <path
      d="M40 10 C50 8, 56 14, 54 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Arrow head */}
    <path
      d="M51 20 L54.5 25 L58 20"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
));
