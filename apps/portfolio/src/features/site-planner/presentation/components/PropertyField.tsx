import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';
import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { memo } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { PropertyRow } from './PropertyRow';

/**
 * Moves the keyboard into a property field. `NumericEditor` offers no imperative
 * handle, and what it renders is a `contentEditable` rather than an input, so
 * the field is reached through the role that editor announces.
 */
export function focusPropertyField(field: HTMLFieldSetElement | null): void {
  if (!isNil(field)) {
    field.querySelector<HTMLElement>('[role="textbox"]')?.focus();
  }
}

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
    readonly ref?: RefObject<HTMLFieldSetElement | null>;
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
    <fieldset ref={ref} aria-label={label} className="min-w-0">
      <PropertyRow label={label}>
        <NumericEditor
          className="rounded-md text-right"
          value={value}
          decimal={decimal}
          allowNegative={allowNegative}
          onValueChange={onValueChange}
          language={getCurrentLanguage()}
        />
      </PropertyRow>
    </fieldset>
  )
);
