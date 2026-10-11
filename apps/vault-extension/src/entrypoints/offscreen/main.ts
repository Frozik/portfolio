import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';

import { CLIPBOARD_MESSAGE } from '../../infrastructure/offscreen-clipboard';

/** What was copied leaves the clipboard after this long. */
const CLEAR_AFTER_MS = 30_000;
/** Spike S3(г): copying an empty string leaves the clipboard as it was, so the clearing writes a space. */
const CLEARED = ' ';

let clearing: ReturnType<typeof setTimeout> | null = null;

function write(text: string): boolean {
  const area = document.getElementById('clipboard');
  if (!(area instanceof HTMLTextAreaElement)) {
    return false;
  }
  area.value = text;
  area.select();
  return document.execCommand('copy');
}

/** The worker's clipboard: it writes, then clears unconditionally after its time. */
browser.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
  if (
    typeof message !== 'object' ||
    isNil(message) ||
    Reflect.get(message, 'target') !== CLIPBOARD_MESSAGE
  ) {
    return false;
  }
  if (Reflect.get(message, 'clearNow') === true) {
    if (!isNil(clearing)) {
      clearTimeout(clearing);
      clearing = null;
      write(CLEARED);
    }
    respond(true);
    return false;
  }
  const text: unknown = Reflect.get(message, 'text');
  respond(typeof text === 'string' && write(text));
  if (!isNil(clearing)) {
    clearTimeout(clearing);
  }
  clearing = setTimeout(() => write(CLEARED), CLEAR_AFTER_MS);
  return false;
});
