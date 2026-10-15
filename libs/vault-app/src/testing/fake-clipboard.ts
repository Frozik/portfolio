import type { IClipboard } from '../exposure/domain/ports/clipboard';

/**
 * A clipboard that, like a page, is writable only with focus: a clear at a
 * lock without focus is left for later.
 */
export function createFakeClipboard() {
  let focused = true;
  const focusListeners = new Set<() => void>();
  const writes: string[] = [];
  const clearsLater: string[] = [];
  const clipboard: IClipboard = {
    write: text => {
      writes.push(text);
      return Promise.resolve(true);
    },
    canWrite: () => focused,
    onceWritable: listener => {
      focusListeners.add(listener);
      return () => focusListeners.delete(listener);
    },
    clearNow: () => {
      if (focused) {
        writes.push('');
      } else {
        clearsLater.push('pending');
      }
    },
  };
  return {
    clipboard,
    writes,
    clearsLater,
    blur: () => {
      focused = false;
    },
    focus: () => {
      focused = true;
      const listeners = [...focusListeners];
      focusListeners.clear();
      listeners.forEach(listener => listener());
    },
  };
}
