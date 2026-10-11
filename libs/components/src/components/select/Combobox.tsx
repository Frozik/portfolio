import { isNil } from 'lodash-es';
import type { KeyboardEvent, Ref } from 'react';
import { useId, useMemo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import { FieldPopup } from '../popup/FieldPopup';
import { RichEditor } from '../RichEditor/components/RichEditor';
import type { IRichEditorHandle } from '../RichEditor/defs';
import { getCalendarAriaLabels } from '../RichEditor/translations/translations';
import { useRevertOnCancel } from '../RichEditor/use-revert-on-cancel';
import { matchingSuggestions, moveActive } from './listbox-navigation';
import { OptionList, optionIdOf } from './OptionList';
import editorStyles from '../RichEditor/styles.module.css';

/**
 * Free text with suggestions (WAI-ARIA editable combobox
 * with list autocomplete): typing filters the list, arrows pick from it,
 * Enter takes the picked one and otherwise keeps what was typed. The list
 * stays under the field on touch too: a modal sheet would take the keyboard
 * the text is being typed with.
 */
export function Combobox({
  ref,
  className,
  suggestions,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  locale = 'en',
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  readonly ref?: Ref<IRichEditorHandle>;
  readonly className?: string;
  readonly suggestions: readonly string[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly locale?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
}) {
  const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
  const listId = useId();
  const [wanted, setWanted] = useState(false);
  const [active, setActive] = useState<number | undefined>(undefined);
  const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
  const matches = useMemo(
    () => matchingSuggestions(suggestions, value, locale).map(label => ({ value: label, label })),
    [suggestions, value, locale]
  );
  const open = wanted && matches.length > 0;

  const close = useEventCallback(() => {
    setWanted(false);
    setActive(undefined);
  });
  const handleValueChange = useEventCallback((next: string) => {
    onValueChange(next);
    setWanted(true);
    setActive(undefined);
  });
  const choose = useEventCallback((index: number) => {
    const match = matches[index];
    if (!isNil(match)) {
      onValueChange(match.value);
    }
    close();
  });
  const handleFocusChange = useEventCallback((focused: boolean) => {
    rememberOnFocus(focused);
    if (!focused) {
      close();
    }
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setWanted(true);
      setActive(
        open
          ? moveActive(matches, active, event.key === 'ArrowDown' ? 'next' : 'previous')
          : undefined
      );
    } else if (event.key === 'Enter' && open && !isNil(active)) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });

  return (
    <FieldPopup
      open={open}
      held
      sheet={undefined}
      handleLabel={labels.showOptions}
      onDismiss={close}
      className={editorStyles.field}
      field={
        <RichEditor
          ref={ref}
          className={cn(editorStyles.editor, className)}
          value={value}
          onValueChange={handleValueChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocusChange={handleFocusChange}
          onCancel={cancel}
          onKeyDown={handleKeyDown}
          combobox={{
            listId,
            expanded: open,
            activeOptionId: open && !isNil(active) ? optionIdOf(listId, active) : undefined,
          }}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
      }
    >
      <OptionList
        id={listId}
        label={ariaLabel ?? labels.options}
        options={matches}
        active={active}
        isSelected={candidate => candidate === value}
        onChoose={choose}
        onActivate={setActive}
      />
    </FieldPopup>
  );
}
