import { isNil } from 'lodash-es';
import type { MouseEvent } from 'react';
import { Fragment, useEffect, useRef } from 'react';
import { cn } from '../cn';

import type { IListboxOption } from './listbox-navigation';
import controlTokens from '../control-tokens.module.css';
import styles from './select.module.css';

export function optionIdOf(listId: string, index: number): string {
  return `${listId}-option-${index}`;
}

interface IOptionRun<TValue extends string> {
  readonly group: string | undefined;
  readonly start: number;
  readonly entries: readonly { readonly option: IListboxOption<TValue>; readonly index: number }[];
}

function runsOf<TValue extends string>(
  options: readonly IListboxOption<TValue>[]
): readonly IOptionRun<TValue>[] {
  return options.reduce<IOptionRun<TValue>[]>((runs, option, index) => {
    const last = runs.at(-1);
    if (!isNil(last) && last.group === option.group) {
      runs[runs.length - 1] = { ...last, entries: [...last.entries, { option, index }] };
    } else {
      runs.push({ group: option.group, start: index, entries: [{ option, index }] });
    }
    return runs;
  }, []);
}

/**
 * The `listbox` of the select family. Focus never enters
 * it: the field keeps the keyboard and points at the active option with
 * `aria-activedescendant`, so typing and Escape reach the field. Options
 * under one heading sit in a `group` named by it.
 */
export function OptionList<TValue extends string>({
  id,
  label,
  options,
  active,
  isSelected,
  multiple = false,
  onChoose,
  onActivate,
}: {
  readonly id: string;
  readonly label: string;
  readonly options: readonly IListboxOption<TValue>[];
  readonly active: number | undefined;
  readonly isSelected: (value: TValue) => boolean;
  readonly multiple?: boolean;
  readonly onChoose: (index: number) => void;
  readonly onActivate: (index: number) => void;
}) {
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isNil(active)) {
      optionRefs.current[active]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [active]);

  const keepFieldFocused = (event: MouseEvent) => event.preventDefault();

  const optionOf = (option: IListboxOption<TValue>, index: number) => (
    <div
      key={option.value}
      ref={element => {
        optionRefs.current[index] = element;
      }}
      id={optionIdOf(id, index)}
      role="option"
      data-value={option.value}
      tabIndex={-1}
      aria-selected={isSelected(option.value)}
      aria-disabled={option.disabled === true || undefined}
      data-active={index === active || undefined}
      className={styles.option}
      onMouseDown={keepFieldFocused}
      onPointerMove={() => option.disabled !== true && onActivate(index)}
      onClick={() => option.disabled !== true && onChoose(index)}
    >
      {!isNil(option.decoration) && (
        <span className={styles.decoration} aria-hidden="true">
          {option.decoration}
        </span>
      )}
      {option.label}
    </div>
  );

  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      className={cn(controlTokens.tokens, styles.listbox)}
    >
      {runsOf(options).map(({ group, start, entries }) =>
        isNil(group) ? (
          <Fragment key={start}>
            {entries.map(({ option, index }) => optionOf(option, index))}
          </Fragment>
        ) : (
          <div key={start} role="group" aria-labelledby={`${id}-group-${start}`}>
            <div
              id={`${id}-group-${start}`}
              role="presentation"
              className={styles.groupLabel}
              onMouseDown={keepFieldFocused}
            >
              {group}
            </div>
            {entries.map(({ option, index }) => optionOf(option, index))}
          </div>
        )
      )}
    </div>
  );
}
