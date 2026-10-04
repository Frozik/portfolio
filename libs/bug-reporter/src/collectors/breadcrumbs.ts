import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { isNil } from 'lodash-es';

import type { IBreadcrumb } from '../core/breadcrumb';
import { describeElement } from '../core/breadcrumb';
import type { TNow } from '../core/clock';
import { sanitizeUrl } from '../core/sanitize-url';
import { SENSITIVE_SELECTOR } from '../core/sensitive';
import { listen } from './listen';

export interface IBreadcrumbOptions {
  /** Interactions inside the reporter's own UI are noise in a report about the host page. */
  readonly ignoreWithin: (target: Element) => boolean;
}

type TPush = (crumb: Omit<IBreadcrumb, 'timestamp'>) => void;

const SECRET_INPUT_TYPES: ReadonlySet<string> = new Set(['password', 'hidden']);
const SECRET_AUTOCOMPLETE = /^(cc-|new-password|current-password|one-time-code)/;

/** User actions that lead up to the moment of the report: clicks, committed inputs, navigation, visibility and connectivity. */
export function captureBreadcrumbs(
  push: (crumb: IBreadcrumb) => void,
  now: TNow,
  options: IBreadcrumbOptions
): () => void {
  const record: TPush = crumb => push({ ...crumb, timestamp: now() });
  const bag = new DisposableBag();
  bag.add(listen(document, 'click', event => recordClick(event, record, options), true));
  bag.add(listen(document, 'change', event => recordChange(event, record, options), true));
  bag.add(listen(window, 'popstate', () => recordNavigation('popstate', record)));
  bag.add(listen(window, 'hashchange', () => recordNavigation('hashchange', record)));
  bag.add(patchHistory(record));
  bag.add(
    listen(document, 'visibilitychange', () =>
      record({
        category: 'visibility',
        level: 'info',
        message: `Page ${document.visibilityState}`,
        data: {},
      })
    )
  );
  bag.add(listen(window, 'online', () => recordConnectivity(true, record)));
  bag.add(listen(window, 'offline', () => recordConnectivity(false, record)));
  return () => bag.disposeAll();
}

function recordClick(event: MouseEvent, record: TPush, options: IBreadcrumbOptions): void {
  const target = event.target;
  if (!(target instanceof Element) || options.ignoreWithin(target)) {
    return;
  }
  const actionable = target.closest('button, a, [role], input, select, textarea, label') ?? target;
  record({
    category: 'ui.click',
    level: 'info',
    message: describeElement(elementFacts(actionable)),
    data: { x: Math.round(event.clientX), y: Math.round(event.clientY) },
  });
}

function recordChange(event: Event, record: TPush, options: IBreadcrumbOptions): void {
  const target = event.target;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) ||
    options.ignoreWithin(target)
  ) {
    return;
  }
  const type = target instanceof HTMLInputElement ? target.type : target.tagName.toLowerCase();
  if (
    SECRET_INPUT_TYPES.has(type) ||
    SECRET_AUTOCOMPLETE.test(target.autocomplete) ||
    isSensitive(target)
  ) {
    return;
  }
  record({
    category: 'ui.input',
    level: 'info',
    message: describeElement(elementFacts(target)),
    data: { type, name: target.name, length: target.value.length },
  });
}

function recordNavigation(trigger: string, record: TPush): void {
  record({
    category: 'navigation',
    level: 'info',
    message: sanitizeUrl(location.href, location.href),
    data: { trigger },
  });
}

function recordConnectivity(online: boolean, record: TPush): void {
  record({
    category: 'connectivity',
    level: online ? 'info' : 'warning',
    message: online ? 'Back online' : 'Went offline',
    data: {},
  });
}

function patchHistory(record: TPush): () => void {
  const { pushState, replaceState } = History.prototype;
  const wrap = (original: History['pushState'], trigger: string): History['pushState'] =>
    function patched(this: History, ...args) {
      original.apply(this, args);
      recordNavigation(trigger, record);
    };
  const patchedPush = wrap(pushState, 'pushState');
  const patchedReplace = wrap(replaceState, 'replaceState');
  History.prototype.pushState = patchedPush;
  History.prototype.replaceState = patchedReplace;
  return () => {
    if (History.prototype.pushState === patchedPush) {
      History.prototype.pushState = pushState;
    }
    if (History.prototype.replaceState === patchedReplace) {
      History.prototype.replaceState = replaceState;
    }
  };
}

function isSensitive(element: Element): boolean {
  return element.closest(SENSITIVE_SELECTOR) !== null;
}

/** Text in or under a sensitive element is as secret in a breadcrumb as in a capture; so is its accessible name. */
function elementFacts(element: Element) {
  const sensitive = isSensitive(element) || element.querySelector(SENSITIVE_SELECTOR) !== null;
  const visible = element instanceof HTMLElement ? element.innerText : element.textContent;
  return {
    tag: element.tagName,
    id: element.id,
    classes: [...element.classList],
    testId: element.getAttribute('data-testid') ?? '',
    ariaLabel: sensitive ? '' : (element.getAttribute('aria-label') ?? ''),
    role: element.getAttribute('role') ?? '',
    text: sensitive || isNil(visible) ? '' : visible,
  };
}
