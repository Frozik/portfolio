import { afterEach, describe, expect, it } from 'vitest';

import type { IBreadcrumb } from '../core/breadcrumb';
import { FIXTURE_TIME } from '../testing/report-fixture';
import { captureBreadcrumbs } from './breadcrumbs';

const now = () => FIXTURE_TIME;

describe('captureBreadcrumbs', () => {
  const crumbs: IBreadcrumb[] = [];
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    crumbs.length = 0;
    document.body.innerHTML = '';
  });

  function start(ignoreWithin: (target: Element) => boolean = () => false) {
    restore = captureBreadcrumbs(crumb => crumbs.push(crumb), now, { ignoreWithin });
  }

  it('describes a click by the actionable ancestor, not the icon inside it', () => {
    document.body.innerHTML = '<button data-testid="transfer"><span>Send</span></button>';
    start();

    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(crumbs[0]).toMatchObject({
      category: 'ui.click',
      message: 'button[data-testid="transfer"]',
    });
  });

  it('ignores clicks inside the reporter itself', () => {
    document.body.innerHTML = '<div id="reporter"><button>Stop</button></div>';
    start(target => target.closest('#reporter') !== null);

    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(crumbs).toHaveLength(0);
  });

  it('records that a field changed, but never its value', () => {
    document.body.innerHTML = '<input name="amount" value="1500">';
    start();

    document.querySelector('input')?.dispatchEvent(new Event('change', { bubbles: true }));

    expect(crumbs[0]).toMatchObject({ category: 'ui.input', data: { name: 'amount', length: 4 } });
    expect(JSON.stringify(crumbs)).not.toContain('1500');
  });

  it('never records a password or payment field, not even its length', () => {
    document.body.innerHTML =
      '<input type="password" value="hunter2"><input autocomplete="cc-number" value="4111">';
    start();

    for (const input of document.querySelectorAll('input')) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    expect(crumbs).toHaveLength(0);
  });

  it('never quotes the text of a masked element, nor the length of a masked field', () => {
    document.body.innerHTML =
      '<button class="bug-mask">1,500,000.00 USD</button><input class="bug-mask" name="iban" value="DE1234">';
    start();

    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('input')?.dispatchEvent(new Event('change', { bubbles: true }));

    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]?.message).toBe('button.bug-mask');
  });

  it('drops the text of a clickable element that contains a masked part', () => {
    document.body.innerHTML =
      '<button aria-label="Pay 1,250">Pay <span class="bug-mask">1,250</span></button>';
    start();

    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(crumbs[0]?.message).toBe('button');
  });

  it('records in-app navigation through pushState and restores the original afterwards', () => {
    const originalPushState = History.prototype.pushState;
    start();

    history.pushState({}, '', '/portfolio/bug-reporter?token=secret');

    expect(crumbs[0]).toMatchObject({
      category: 'navigation',
      message: `${location.origin}/portfolio/bug-reporter`,
      data: { trigger: 'pushState' },
    });
    restore?.();
    restore = undefined;
    expect(History.prototype.pushState).toBe(originalPushState);
  });
});
