import { isNil } from 'lodash-es';
import type { KeyboardEvent, ReactNode } from 'react';
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
 * One value from a list (WAI-ARIA select-only combobox).
 * Arrows, Home/End and typed letters move through the options; Enter, Space
 * or Tab take the active one, Escape closes without a change. On touch the
 * options rise in a sheet. Generic in the value; not memoised, `memo` erases
 * the type parameter.
 */
export function Select<TValue extends string>({
  className,
  options,
  value,
  onValueChange,
  placeholder,
  icon,
  disabled = false,
  locale = 'en',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  readonly className?: string;
  readonly options: readonly IListboxOption<TValue>[];
  readonly value: TValue | undefined;
  readonly onValueChange: (value: TValue) => void;
  readonly placeholder?: string;
  /** Shows only this in the field, the `aria-label` naming it: a select that is a command, like "new card". */
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  readonly locale?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string;
}) {
  const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
  const listId = useId();
  const usesSheet = useIsCoarsePointer();
  const { open, active, setActive, openAt, close, navigate } = useListbox(options, locale);
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];

  const openList = useEventCallback(() => openAt(selectedIndex >= 0 ? selectedIndex : undefined));
  const choose = useEventCallback((index: number) => {
    const option = options[index];
    if (!isNil(option) && option.disabled !== true) {
      onValueChange(option.value);
    }
    close();
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
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
      if (event.key !== 'Tab') {
        event.preventDefault();
      }
      if (isNil(active)) {
        close();
      } else {
        choose(active);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
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
        isNil(selected)
          ? { kind: 'placeholder', label: placeholder }
          : { kind: 'value', label: selected.label, decoration: selected.decoration }
      }
      icon={icon}
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
        isSelected={candidate => candidate === value}
        onChoose={choose}
        onActivate={setActive}
      />
    </ListboxField>
  );
}
