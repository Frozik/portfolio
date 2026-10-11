import { isNil } from 'lodash-es';

import { collectFields } from '../../fill/collect-fields';
import { detectLoginForm } from './detect-login-form';
import type { TLoginForm } from './detect-login-form';
import { LOGIN_FORMS, SHADOW_LOGIN } from './fixtures/login-forms';

/** The page of a fixture; a `login-box` gets its form in a shadow root, open or closed as it says. */
function pageOf(html: string) {
  const page = document.implementation.createHTMLDocument('fixture');
  page.body.innerHTML = html;
  const closed = new Map<Element, ShadowRoot>();
  for (const host of page.querySelectorAll('login-box')) {
    const mode = host.getAttribute('data-shadow') === 'closed' ? 'closed' : 'open';
    const shadow = host.attachShadow({ mode });
    shadow.innerHTML = SHADOW_LOGIN;
    closed.set(host, shadow);
  }
  return { page, openShadow: (element: Element) => closed.get(element) ?? null };
}

function marked(
  form: TLoginForm,
  inputs: readonly HTMLInputElement[]
): Readonly<Record<string, number>> {
  const roleOf = (index: number | null): string | null =>
    isNil(index) ? null : (inputs[index]?.getAttribute('data-expect') ?? 'unmarked');
  switch (form.kind) {
    case 'login':
      return { [roleOf(form.username) ?? 'no username']: 1, [roleOf(form.password) ?? '']: 1 };
    case 'username':
      return { [roleOf(form.username) ?? '']: 1 };
    case 'otp':
      return form.fields.reduce<Record<string, number>>((counts, index) => {
        const role = roleOf(index) ?? '';
        return { ...counts, [role]: (counts[role] ?? 0) + 1 };
      }, {});
    default:
      return {};
  }
}

describe('the login form detector', () => {
  it.each(LOGIN_FORMS)('reads $name', ({ html, kind }) => {
    const { page, openShadow } = pageOf(html);
    const { records, inputs } = collectFields(page, openShadow);

    const form = detectLoginForm(records);

    expect(form.kind).toBe(kind);
    const expected = inputs.reduce<Record<string, number>>((counts, input) => {
      const role = input.getAttribute('data-expect');
      return isNil(role) ? counts : { ...counts, [role]: (counts[role] ?? 0) + 1 };
    }, {});
    const found = marked(form, inputs);
    if (form.kind === 'login' && !Object.hasOwn(expected, 'username')) {
      expect(found).toEqual({ 'no username': 1, ...expected });
    } else {
      expect(found).toEqual(expected);
    }
  });

  it('cannot reach a closed shadow root without the extension’s opener', () => {
    const { page } = pageOf('<login-box data-shadow="closed"></login-box>');

    expect(detectLoginForm(collectFields(page, () => null).records)).toEqual({ kind: 'none' });
  });
});
