import { cn } from '@frozik/components/components/cn';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { CardFrame } from '../../../../shared/ui/CardFrame';

const PanelComponent = ({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) => (
  <CardFrame className={cn('min-w-0', className)}>
    <section className="flex h-full min-w-0 flex-col gap-4 p-5">
      <h2 className="font-mono text-[11px] tracking-[0.1em] text-landing-fg-faint uppercase">
        {title}
      </h2>
      {children}
    </section>
  </CardFrame>
);

export const Panel = memo(PanelComponent);
