import { isNil } from 'lodash-es';
import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';

/**
 * The worker takes requests only from the extension's own
 * pages, wherever they are open (the popup, or a page in a tab): the sender's
 * address is the extension's origin. A script in a web page reports that
 * page's address and is never answered.
 */
export function isTrustedSender(sender: Browser.runtime.MessageSender): boolean {
  return (
    sender.id === browser.runtime.id &&
    !isNil(sender.url) &&
    sender.url.startsWith(`${location.origin}/`)
  );
}
