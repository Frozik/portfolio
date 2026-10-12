import { isNil } from 'lodash-es';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import { FieldPopup } from '../popup/FieldPopup';
import { optionIdOf } from './OptionList';
import controlTokens from '../control-tokens.module.css';
import editorStyles from '../RichEditor/styles.module.css';
import styles from './select.module.css';

/**
 * The field of `Select` and `MultiSelect`: a button in the editor's frame
 * that owns the list and keeps focus while the list is open.
 */
export function ListboxField({
  className,
  listId,
  open,
  active,
  usesSheet,
  label,
  handleLabel,
  text,
  icon,
  disabled,
  onOpen,
  onClose,
  onKeyDown,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  children,
}: {
  readonly className?: string;
  readonly listId: string;
  readonly open: boolean;
  readonly active: number | undefined;
  readonly usesSheet: boolean;
  readonly label: string;
  readonly handleLabel: string;
  /** What the field shows: the chosen labels and picture, or the placeholder when nothing is chosen. */
  readonly text: {
    readonly kind: 'value' | 'placeholder';
    readonly label: string | undefined;
    readonly decoration?: ReactNode;
  };
  /** Shown alone in the field, the label kept for assistive technology and the tooltip: a command such as "new card". */
  readonly icon?: ReactNode;
  readonly disabled: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string;
  readonly children: ReactNode;
}) {
  /** The sheet is modal and takes focus from the field; only the sheet closes itself then. */
  const handleBlur = useEventCallback(() => {
    if (!usesSheet) {
      onClose();
    }
  });

  return (
    <FieldPopup
      open={open}
      held
      sheet={usesSheet ? { label, onClose } : undefined}
      handleLabel={handleLabel}
      onDismiss={onClose}
      className={cn(controlTokens.tokens, editorStyles.field)}
      field={
        <button
          type="button"
          role="combobox"
          className={cn(
            controlTokens.tokens,
            editorStyles.editor,
            styles.trigger,
            !isNil(icon) && styles.iconTrigger,
            className
          )}
          disabled={disabled}
          aria-label={ariaLabel}
          title={isNil(icon) ? undefined : ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && !isNil(active) ? optionIdOf(listId, active) : undefined}
          onClick={open ? onClose : onOpen}
          onKeyDown={onKeyDown}
          onBlur={handleBlur}
        >
          {isNil(icon) ? (
            <>
              {!isNil(text.decoration) && (
                <span className={styles.decoration} aria-hidden="true">
                  {text.decoration}
                </span>
              )}
              <span
                className={cn(
                  styles.triggerText,
                  text.kind === 'placeholder' && styles.placeholder
                )}
              >
                {text.label}
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ▾
              </span>
            </>
          ) : (
            <span className={styles.decoration} aria-hidden="true">
              {icon}
            </span>
          )}
        </button>
      }
    >
      {children}
    </FieldPopup>
  );
}
