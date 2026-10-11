import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '../cn';
import styles from './styles.module.css';

/** Six dots: the handle a row is dragged by. */
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.4" />
      <circle cx="8" cy="2" r="1.4" />
      <circle cx="2" cy="7" r="1.4" />
      <circle cx="8" cy="7" r="1.4" />
      <circle cx="2" cy="12" r="1.4" />
      <circle cx="8" cy="12" r="1.4" />
    </svg>
  );
}

/**
 * One row of `ListEditor`: the item's control, then its
 * handle and remove button together. The handle drags the row, or takes it
 * with Space for the arrows.
 */
export function ListEditorRow({
  id,
  number,
  disabled,
  movable,
  moveLabel,
  removeLabel,
  onRemove,
  onKeyDownCapture,
  children,
}: {
  readonly id: string;
  /** The row's place shown before it; the marked one stands out (the one in use of a rotation). */
  readonly number: {
    readonly value: number;
    readonly marked: boolean;
    readonly label?: string;
  } | null;
  readonly disabled: boolean;
  /** A lone item has nowhere to go. */
  readonly movable: boolean;
  readonly moveLabel: string;
  readonly removeLabel: string;
  readonly onRemove: () => void;
  readonly onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: disabled || !movable });
  return (
    <div
      ref={setNodeRef}
      className={cn(styles.listRow, isDragging && styles.listRowDragging)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onKeyDownCapture={onKeyDownCapture}
    >
      {number !== null && (
        <span
          className={cn(styles.listNumber, number.marked && styles.listNumberMarked)}
          title={number.label}
        >
          {number.value}
        </span>
      )}
      <div className={styles.listValue}>{children}</div>
      <span className={styles.listActions}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={cn(styles.listButton, styles.listHandle)}
          disabled={disabled || !movable}
          {...attributes}
          {...listeners}
          aria-label={moveLabel}
        >
          <GripIcon />
        </button>
        <button
          type="button"
          className={styles.listButton}
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          ×
        </button>
      </span>
    </div>
  );
}
