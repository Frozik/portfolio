import { browser } from 'wxt/browser';

import type { IRestart } from '../domain/ports';

/** A lock reloads the extension, so nothing of the session stays in any of its pages. */
export const CHROME_RESTART: IRestart = {
  reload() {
    browser.runtime.reload();
  },
};
