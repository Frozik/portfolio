import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

import type { IFillRequest } from '../domain/ports';
import { fillPage } from '../fill/fill-page';
import { FILL_GLOBAL } from '../infrastructure/page-filler';

/** Drawn with a size, and not pushed off the page's top or left edge. */
function isOnPage(input: HTMLInputElement): boolean {
  const box = input.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.right + scrollX > 0 && box.bottom + scrollY > 0;
}

/** Whether the tab's top page is HTTPS: a frame of another origin learns it from its ancestors, not from the top. */
function topIsSecure(): boolean {
  const ancestors = location.ancestorOrigins;
  const top = ancestors.length > 0 ? ancestors.item(ancestors.length - 1) : location.origin;
  return !isNil(top) && top.startsWith('https:');
}

/**
 * Injected into every frame in the isolated world on the
 * user's click: it names one function, which fills its own frame only.
 */
export default defineUnlistedScript(() => {
  Reflect.set(globalThis, FILL_GLOBAL, (request: IFillRequest) =>
    fillPage(
      { document, url: location.href, topIsSecure: topIsSecure() },
      request,
      element => browser.dom.openOrClosedShadowRoot(element as HTMLElement),
      isOnPage
    )
  );
});
