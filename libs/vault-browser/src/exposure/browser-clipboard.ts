import type { IClipboard } from '@frozik/vault-app/exposure/domain/ports/clipboard';

const PENDING_CLEAR_KEY = 'pwv:clear-clipboard';

function onceFocused(listener: () => void): () => void {
  const controller = new AbortController();
  window.addEventListener('focus', listener, { once: true, signal: controller.signal });
  return () => controller.abort();
}

function writeText(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}

/** A refused write (no focus, no permission) is `false`, not an error: the user simply copies again. */
export const BROWSER_CLIPBOARD: IClipboard = {
  write: writeText,
  canWrite: () => document.hasFocus(),
  onceWritable: onceFocused,
  /** Without focus the page cannot write: the reloaded page clears once it has focus. */
  clearNow: () => {
    if (document.hasFocus()) {
      void writeText('');
    } else {
      sessionStorage.setItem(PENDING_CLEAR_KEY, '1');
    }
  },
};

/** A lock without focus left a copy in the clipboard; this page clears it once it has focus. */
export function resumePendingClipboardClear(): () => void {
  if (sessionStorage.getItem(PENDING_CLEAR_KEY) === null) {
    return () => undefined;
  }
  const clear = (): void => {
    sessionStorage.removeItem(PENDING_CLEAR_KEY);
    void writeText('');
  };
  if (document.hasFocus()) {
    clear();
    return () => undefined;
  }
  return onceFocused(clear);
}
