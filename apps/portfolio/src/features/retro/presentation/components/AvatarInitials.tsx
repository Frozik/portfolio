import type { ReactNode } from 'react';
import { memo } from 'react';

/** Initials on the accent colour, filling the avatar circle when there is no picture to show. */
export const AvatarInitials = memo(({ children }: { readonly children: ReactNode }) => (
  <span className="flex h-full w-full items-center justify-center bg-landing-accent">
    {children}
  </span>
));
