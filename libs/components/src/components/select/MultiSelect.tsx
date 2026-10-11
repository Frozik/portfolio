import { isNil, xor } from 'lodash-es';
import type { KeyboardEvent } from 'react';
import { useId, useMemo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useIsCoarsePointer } from '../../hooks/useIsCoarsePointer';
import { getCalendarAriaLabels } from '../RichEditor/translations/translations';
import type { IListboxOption } from './listbox-navigation';
import { isOpeningKey } from './listbox-navigation';
import { ListboxField } from './ListboxField';
import { OptionList } from './OptionList';
import { useListbox } from './use-listbox';

/**
 * Several values from a list (the groups of a card).
 * Enter or Space ticks the active option and the list stays open; Escape or
 * Tab closes it. The field lists the chosen labels in the options' order.
 */
export function MultiSelect<TValue extends string>({
  className,
  options,
  values,
  onValuesChange,
  placeholder,
  disabled = false,
  locale = 'en',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  readonly className?: string;
  readonly options: readonly IListboxOption<TValue>[];
  readonly values: readonly TValue[];
  readonly onValuesChange: (values: readonly TValue[]) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly locale?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string;
}) {
  const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
  const listId = useId();
  const usesSheet = useIsCoarsePointer();
  const { open, active, setActive, openAt, close, navigate } = useListbox(options, locale);
  const chosen = options.filter(option => values.includes(option.value));

  const openList = useEventCallback(() => openAt(undefined));
  const toggle = useEventCallback((index: number) => {
    const option = options[index];
    if (!isNil(option) && option.disabled !== true) {
      onValuesChange(xor(values, [option.value]));
    }
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (isOpeningKey(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (navigate(event)) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isNil(active)) {
        toggle(active);
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
      close();
    }
  });

  return (
    <ListboxField
      className={className}
      listId={listId}
      open={open}
      active={active}
      usesSheet={usesSheet}
      label={ariaLabel ?? labels.options}
      handleLabel={labels.showOptions}
      text={
        chosen.length === 0
          ? { kind: 'placeholder', label: placeholder }
          : { kind: 'value', label: chosen.map(option => option.label).join(', ') }
      }
      disabled={disabled}
      onOpen={openList}
      onClose={close}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <OptionList
        id={listId}
        label={ariaLabel ?? labels.options}
        options={options}
        active={active}
        multiple
        isSelected={candidate => values.includes(candidate)}
        onChoose={toggle}
        onActivate={setActive}
      />
    </ListboxField>
  );
}
