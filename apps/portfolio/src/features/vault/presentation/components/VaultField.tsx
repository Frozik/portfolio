import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { editorT } from '../translations/editor';
import { CHANGED_MARK_CLASS } from './changed-mark';

/**
 * A labelled control with a hint or an error under it; the control gets
 * `describedBy` to point at that text. An observer, because the control is
 * rendered here: what it reads from a store is tracked by this component.
 */
export const VaultField = observer(
  ({
    label,
    hint,
    error,
    changed = false,
    children,
  }: {
    readonly label: string;
    /** The value differs from the saved one: the field is marked until the card is saved. */
    readonly changed?: boolean;
    readonly hint?: ReactNode;
    readonly error?: string | null;
    readonly children: (describedBy: string) => ReactNode;
  }) => {
    const describedBy = useId();
    return (
      <div className={cn('flex flex-col gap-1.5', changed && CHANGED_MARK_CLASS)}>
        <span className="text-[13px] font-medium text-landing-fg">
          {label}
          {changed && <span className="sr-only"> ({editorT.changed})</span>}
        </span>
        {children(describedBy)}
        <span
          id={describedBy}
          className={cn(
            'text-[12px] leading-[1.4]',
            error ? 'text-error' : 'text-landing-fg-faint'
          )}
        >
          {error ?? hint}
        </span>
      </div>
    );
  }
);
