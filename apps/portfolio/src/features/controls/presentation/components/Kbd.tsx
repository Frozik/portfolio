import type { ReactNode } from 'react';
import { memo } from 'react';

export const Kbd = memo(({ children }: { readonly children: ReactNode }) => (
  <kbd className="inline-flex items-center border border-landing-border-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-landing-fg-dim">
    {children}
  </kbd>
));
