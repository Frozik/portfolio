import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';

import type { IEditorProps } from '../editing-column';
import { useEditorFocus } from './useEditorFocus';

export function NumberEditor<TRow>({
  draft,
  initialKey,
  onChange,
  options,
  locale,
}: IEditorProps<TRow, number | undefined>) {
  const ref = useRef<IRichEditorHandle>(null);
  useEditorFocus(ref);
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    if (initialKey !== undefined) {
      const digit = Number(initialKey);
      onChange(Number.isInteger(digit) ? digit : undefined);
    }
  }
  const handleChange = useEventCallback((value: number | undefined) => onChange(value));
  return (
    <NumericEditor
      ref={ref}
      className="ft-editor-field"
      value={draft}
      onValueChange={handleChange}
      decimal={options.decimal}
      min={options.min}
      max={options.max}
      step={options.step}
      allowNegative={options.allowNegative ?? true}
      locale={locale}
    />
  );
}
