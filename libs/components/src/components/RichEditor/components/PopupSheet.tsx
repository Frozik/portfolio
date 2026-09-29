import { isNil } from 'lodash-es';
import type { MouseEvent, ReactNode } from 'react';
import { memo, useEffect, useRef } from 'react';

import { useEventCallback } from 'usehooks-ts';
import { PopupHandle } from './PopupHandle';
import styles from '../styles.module.css';

/** A modal `<dialog>` rising from the bottom of the screen; its handle, the backdrop and Escape shut it. */
export const PopupSheet = memo(
  ({
    open,
    label,
    handleLabel,
    onClose,
    children,
  }: {
    readonly open: boolean;
    readonly label: string;
    readonly handleLabel: string;
    readonly onClose: () => void;
    readonly children: ReactNode;
  }) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
      const dialog = dialogRef.current;
      if (isNil(dialog) || dialog.open === open) {
        return;
      }
      if (!open) {
        dialog.close();
        return;
      }
      // A closing dialog hands focus back to where it was: the field, whose keyboard would cover the value just picked.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      dialog.showModal();
    }, [open]);

    const handleClick = useEventCallback((event: MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    });

    return (
      <dialog
        ref={dialogRef}
        className={styles.popupSheet}
        aria-label={label}
        onClose={onClose}
        onClick={handleClick}
      >
        <PopupHandle label={handleLabel} onPress={onClose} />
        {children}
      </dialog>
    );
  }
);
