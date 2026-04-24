import type { ReactNode } from 'react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { MonoKicker } from '../../../../shared/ui';

type PendulumSectionProps = {
  readonly number: string;
  readonly title: string;
  readonly heightClass: string;
  readonly children: ReactNode;
  readonly className?: string;
};

const PendulumSectionComponent = ({
  number,
  title,
  heightClass,
  children,
  className,
}: PendulumSectionProps) => (
  <section
    className={cn(
      'group relative w-full overflow-hidden border-b border-landing-border-soft last:border-b-0',
      heightClass,
      className
    )}
  >
    <div className="pointer-events-none absolute top-3 right-4 z-20 flex items-center gap-3 bg-landing-bg-card/70 px-2 py-1 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-0">
      <MonoKicker tone="accent">{number}</MonoKicker>
      <span className="text-sm text-landing-fg">{title}</span>
    </div>
    <div className="absolute inset-0">{children}</div>
  </section>
);

export const PendulumSection = memo(PendulumSectionComponent);

export type { PendulumSectionProps };
