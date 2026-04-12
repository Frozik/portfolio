import { cn } from '../../../../shared/lib/cn';

export function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-brand-500/15 text-brand-400 pointer-events-none'
      : 'text-text-secondary hover:bg-surface-overlay hover:text-text'
  );
}
