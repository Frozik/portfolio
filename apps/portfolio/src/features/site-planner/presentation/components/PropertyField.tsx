import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';
import type { Ref } from 'react';
import { memo } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { PropertyRow } from './PropertyRow';

/** Captioned numeric input — the keyboard path to every exact value in the editor (R20). */
export const PropertyField = memo(
  ({
    ref,
    label,
    value,
    decimal,
    allowNegative = false,
    onValueChange,
  }: {
    /** Reaches the editor itself, so the keyboard can be sent into the field. */
    readonly ref?: Ref<IRichEditorHandle>;
    readonly label: string;
    readonly value: number;
    readonly decimal: number;
    readonly allowNegative?: boolean;
    readonly onValueChange: (value: number | undefined) => void;
  }) => (
    // The editor is a contentEditable rather than an input, so the caption is
    // tied to it by a named group instead of a label association. A fieldset
    // carries `min-inline-size: min-content` from the user agent, which would
    // hold the row wider than the card it sits in — `min-w-0` gives that up.
    <fieldset aria-label={label} className="min-w-0">
      <PropertyRow label={label}>
        <NumericEditor
          ref={ref}
          className="rounded-md text-right"
          value={value}
          decimal={decimal}
          allowNegative={allowNegative}
          onValueChange={onValueChange}
          locale={getCurrentLanguage()}
        />
      </PropertyRow>
    </fieldset>
  )
);
