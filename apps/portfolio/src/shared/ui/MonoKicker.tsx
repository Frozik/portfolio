import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { ReactNode } from 'react';
import { memo } from 'react';

type MonoKickerTone = 'faint' | 'dim' | 'accent';

function toneClass(tone: MonoKickerTone): string {
  switch (tone) {
    case 'faint':
      return 'text-landing-fg-faint';
    case 'dim':
      return 'text-landing-fg-dim';
    case 'accent':
      return 'text-landing-accent';
    default:
      return assertNever(tone);
  }
}

/**
 * Uppercase mono label used everywhere in the redesigned Retro surfaces
 * (section kickers, micro-captions, badge-style counters). Keeps the
 * tracking and size consistent with the prototype.
 */
const MonoKickerComponent = ({
  children,
  tone = 'faint',
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: MonoKickerTone;
  readonly className?: string;
}) => (
  <span
    className={cn('font-mono text-[10px] uppercase tracking-[0.1em]', toneClass(tone), className)}
  >
    {children}
  </span>
);

export const MonoKicker = memo(MonoKickerComponent);

export type { MonoKickerTone };
