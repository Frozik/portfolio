import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { MonoKicker } from '../../../../shared/ui/MonoKicker';

/** A field of the form showcase: its kicker, the control and an optional hint. */
export const FormField = memo(
  ({
    label,
    hint,
    children,
  }: {
    readonly label: string;
    readonly hint?: string;
    readonly children: ReactNode;
  }) => (
    <div className="flex flex-col gap-2">
      <MonoKicker tone="faint">{label}</MonoKicker>
      {children}
      {!isNil(hint) && <p className="text-[12px] text-landing-fg-faint">{hint}</p>}
    </div>
  )
);
