import { cn } from '@frozik/components/components/cn';
import { Check } from 'lucide-react';
import { memo } from 'react';

const ICON_SIZE = 12;

/** Where a step-by-step flow is: the steps done, the current one, the ones ahead. */
export const WizardSteps = memo(
  ({ steps, current }: { readonly steps: readonly string[]; readonly current: number }) => (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 text-[13px]',
              active ? 'text-landing-fg' : 'text-landing-fg-faint'
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border font-mono text-[12px]',
                active ? 'border-landing-accent text-landing-accent' : 'border-landing-border-soft'
              )}
            >
              {done ? <Check size={ICON_SIZE} aria-hidden /> : index + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  )
);
