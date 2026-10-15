import { isNil } from 'lodash-es';

/** The CSS variable bottom sheets lift themselves by. */
export const KEYBOARD_INSET = '--keyboard-inset';

/**
 * iOS lays the on-screen keyboard over the layout viewport, so a sheet fixed
 * to the bottom disappears behind it. The part of the window the keyboard
 * covers, from the visual viewport, goes into `--keyboard-inset`.
 */
export function followKeyboardInset(root: HTMLElement): () => void {
  const viewport = window.visualViewport;
  if (isNil(viewport)) {
    return () => undefined;
  }
  const update = (): void => {
    const covered = window.innerHeight - viewport.height - viewport.offsetTop;
    root.style.setProperty(KEYBOARD_INSET, `${Math.max(0, Math.round(covered))}px`);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    root.style.removeProperty(KEYBOARD_INSET);
  };
}
