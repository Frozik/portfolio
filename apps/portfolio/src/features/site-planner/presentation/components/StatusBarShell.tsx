import type { ReactNode } from 'react';
import { memo } from 'react';

/** The strip along the bottom of the workspace; both view modes fill it differently. */
export const StatusBarShell = memo(({ children }: { readonly children: ReactNode }) => (
  <footer className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-text-secondary">
    {children}
  </footer>
));
