import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';

import type { TRequest, TResponseOf } from '../domain/messages';
import type { IActiveTab, TAskWorker } from '../domain/ports';

/** The popup asks, the worker answers; the answer's shape is the request's by kind. */
export const askWorker: TAskWorker = <Request extends TRequest>(
  request: Request
): Promise<TResponseOf<Request>> => browser.runtime.sendMessage(request);

/** The WebDAV server's origin, granted by the user in Chrome's own prompt. */
export async function requestHost(url: string): Promise<boolean> {
  const origin = URL.canParse(url) ? new URL(url).origin : null;
  if (isNil(origin) || !origin.startsWith('https:')) {
    return false;
  }
  return browser.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
}

/** The tab under the popup: its address is the extension's to read for this click (`activeTab`). */
export async function activeTab(): Promise<IActiveTab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return isNil(tab?.id) || isNil(tab.url) ? null : { id: tab.id, url: tab.url };
}

const IN_TAB = 'tab';

/** Whether this page is the popup opened as a tab, which Google's window does not close. */
export function isPopupInTab(): boolean {
  return new URLSearchParams(location.search).has(IN_TAB);
}

/** The popup again, as a tab of its own; the popup closes as the tab takes focus. */
export function openPopupInTab(): void {
  void browser.tabs.create({ url: new URL(`?${IN_TAB}`, location.href).href });
}

/** A tab opened by the extension may not close itself with `window.close()`; the tabs API may. */
export function closeThisTab(): void {
  void browser.tabs.getCurrent().then(tab => {
    if (!isNil(tab?.id)) {
      void browser.tabs.remove(tab.id);
    }
  });
}
