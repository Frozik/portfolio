import { browser } from 'wxt/browser';

import type { IExtensionClipboard } from '../domain/ports';

const OFFSCREEN_PATH = '/offscreen.html';
export const CLIPBOARD_MESSAGE = 'pwv-clipboard';

/**
 * The offscreen document writes the text
 * and clears it after its time, though the popup has long closed by then.
 */
export const OFFSCREEN_CLIPBOARD: IExtensionClipboard = {
  async copy(text) {
    if (!(await browser.offscreen.hasDocument())) {
      await browser.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['CLIPBOARD'],
        justification:
          'Copy a login or a password, and clear it from the clipboard after 30 seconds',
      });
    }
    const answer: unknown = await browser.runtime.sendMessage({ target: CLIPBOARD_MESSAGE, text });
    return answer === true;
  },
  async clearPending() {
    if (await browser.offscreen.hasDocument()) {
      await browser.runtime.sendMessage({ target: CLIPBOARD_MESSAGE, clearNow: true });
    }
  },
};
