import type { IClipboard } from '@frozik/vault-app/exposure/domain/ports/clipboard';
import { setStringAsync } from 'expo-clipboard';

function writeText(text: string): Promise<boolean> {
  return setStringAsync(text).then(
    written => written,
    () => false
  );
}

/** An app in front may always write the clipboard; one in the background is about to be locked anyway. */
export const NATIVE_CLIPBOARD: IClipboard = {
  write: writeText,
  canWrite: () => true,
  onceWritable: listener => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        listener();
      }
    });
    return () => {
      cancelled = true;
    };
  },
  clearNow: () => void writeText(''),
};
