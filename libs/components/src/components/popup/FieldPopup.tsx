import * as Popover from '@radix-ui/react-popover';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { PopupDrawer } from './PopupDrawer';
import { PopupSheet } from './PopupSheet';
import styles from './popup.module.css';

/** Keeps the popup this far from the viewport edges. */
const COLLISION_PADDING = 8;

function preventFocusSteal(event: Event): void {
  event.preventDefault();
}

/**
 * A field with a popup the owner opens: pulled out from
 * under the field on a fine pointer, a sheet from the bottom on touch. Focus
 * stays where the owner put it; the popup never takes it on open or close.
 * Closing on a press outside does not rely on the field losing focus: Safari
 * and Firefox on macOS never focus a clicked button.
 */
export function FieldPopup({
  open,
  held,
  sheet,
  handleLabel,
  onDismiss,
  className,
  field,
  children,
}: {
  readonly open: boolean;
  /** Pulled out whatever the pointer does; otherwise only the handle shows until the pointer comes. */
  readonly held: boolean;
  /** On touch the popup is a sheet instead: its name for assistive technology, and what shuts it. */
  readonly sheet: { readonly label: string; readonly onClose: () => void } | undefined;
  readonly handleLabel: string;
  /** A press outside the field and the popup, or Escape: the owner decides whether that closes it. */
  readonly onDismiss?: () => void;
  readonly className?: string;
  readonly field: ReactNode;
  readonly children: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const handleOpenChange = useEventCallback((next: boolean) => {
    if (!next) {
      onDismiss?.();
    }
  });
  /** The field is outside the popup but owns it: a press there is the field's own toggle, not a dismissal. */
  const handleInteractOutside = useEventCallback((event: Event) => {
    if (event.target instanceof Node && anchorRef.current?.contains(event.target) === true) {
      event.preventDefault();
    }
  });

  return (
    <Popover.Root open={open && isNil(sheet)} onOpenChange={handleOpenChange}>
      <Popover.Anchor ref={anchorRef} className={className}>
        {field}
        {!isNil(sheet) && (
          <PopupSheet
            open={open}
            label={sheet.label}
            handleLabel={handleLabel}
            onClose={sheet.onClose}
          >
            {children}
          </PopupSheet>
        )}
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className={styles.popoverLayer}
          align="start"
          collisionPadding={COLLISION_PADDING}
          onOpenAutoFocus={preventFocusSteal}
          onCloseAutoFocus={preventFocusSteal}
          onInteractOutside={handleInteractOutside}
        >
          <PopupDrawer held={held} label={handleLabel}>
            {children}
          </PopupDrawer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
