import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { Language } from '../../shared/i18n/types';
import { PRERENDER_ATTRIBUTE } from '../prerender/assemble-landing-html';

const ROOT_ID = 'root';

export interface RootContainer {
  readonly element: HTMLElement;
  /** True when the element holds the landing markup rendered at build time. */
  readonly isPrerendered: boolean;
}

/**
 * The element React mounts into. A built page carries one prerendered root
 * per language: the one for `language` is kept (and becomes `#root`), the
 * others are dropped. A page without them — the dev server, `404.html` —
 * has the plain `#root`.
 */
export function selectRootContainer(document: Document, language: Language): RootContainer {
  const prerendered = [...document.querySelectorAll<HTMLElement>(`[${PRERENDER_ATTRIBUTE}]`)];
  if (prerendered.length === 0) {
    const element = document.getElementById(ROOT_ID);
    assert(!isNil(element), `Root element with ID '${ROOT_ID}' was not found in the document`);
    return { element, isPrerendered: false };
  }
  const match = prerendered.find(element => element.getAttribute(PRERENDER_ATTRIBUTE) === language);
  assert(!isNil(match), `No prerendered root for language '${language}'`);
  for (const element of prerendered) {
    if (element !== match) {
      element.remove();
    }
  }
  match.id = ROOT_ID;
  return { element: match, isPrerendered: true };
}

/**
 * Whether the prerendered markup is the page being opened. The landing is
 * the only prerendered route; a deep link served through `404.html` or the
 * service worker's fallback lands here too, and must render from scratch
 * rather than hydrate the wrong page.
 */
export function shouldHydrate(
  container: RootContainer,
  pathname: string,
  basename: string
): boolean {
  return container.isPrerendered && (pathname === `${basename}/` || pathname === basename);
}
