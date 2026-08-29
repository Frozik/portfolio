import type { SVGProps } from 'react';
import { memo } from 'react';

export const SvgQrCode = memo((props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    width="1em"
    height="1em"
    aria-hidden="true"
    {...props}
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
    <path d="M14 14h3v3M17 19h1M20 14v1M20 17v4M14 19h1" />
  </svg>
));
