import type { IFillRequest } from '../domain/ports';
import { fillPage } from './fill-page';

const REQUEST: IFillRequest = {
  username: 'jane',
  password: 's3cret',
  otp: '123456',
  addresses: [
    {
      stored: 'https://github.com',
      spec: { kind: 'url', match: 'host', useSharedCredentials: true },
    },
  ],
  allowInsecure: false,
};

function aPage(html: string) {
  const page = document.implementation.createHTMLDocument('page');
  page.body.innerHTML = html;
  return page;
}

const NO_SHADOW = () => null;

describe('filling a page', () => {
  it('types login and password so a controlled input sees every keystroke event', () => {
    const page = aPage(
      '<form><input type="text" autocomplete="username"><input type="password" autocomplete="current-password"></form>'
    );
    const heard: string[] = [];
    page.addEventListener(
      'input',
      event => heard.push((event.target as HTMLInputElement).value),
      true
    );

    const outcome = fillPage(
      { document: page, url: 'https://github.com/login', topIsSecure: true },
      REQUEST,
      NO_SHADOW
    );

    expect(outcome).toBe('filled');
    expect(heard).toEqual(['jane', 's3cret']);
  });

  it('puts one character of the code in each box of a split one-time code', () => {
    const page = aPage(`<div>${'<input inputmode="numeric" maxlength="1">'.repeat(6)}</div>`);

    fillPage(
      { document: page, url: 'https://github.com/sessions/two-factor', topIsSecure: true },
      REQUEST,
      NO_SHADOW
    );

    expect([...page.querySelectorAll('input')].map(input => input.value).join('')).toBe('123456');
  });

  it('refuses a frame of another site, and a plain-HTTP page unless the user allowed it', () => {
    const form = '<form><input type="text"><input type="password"></form>';

    expect(
      fillPage(
        { document: aPage(form), url: 'https://github.com.evil.net/', topIsSecure: true },
        REQUEST,
        NO_SHADOW
      )
    ).toBe('other-site');
    expect(
      fillPage(
        { document: aPage(form), url: 'http://github.com/login', topIsSecure: false },
        REQUEST,
        NO_SHADOW
      )
    ).toBe('insecure-page');
    expect(
      fillPage(
        { document: aPage(form), url: 'http://github.com/login', topIsSecure: false },
        { ...REQUEST, allowInsecure: true },
        NO_SHADOW
      )
    ).toBe('filled');
    expect(
      fillPage(
        { document: aPage(form), url: 'http://github.com/login', topIsSecure: true },
        { ...REQUEST, allowInsecure: true },
        NO_SHADOW
      )
    ).toBe('insecure-page');
  });

  it('leaves a sign-up form alone', () => {
    const page = aPage(
      '<form><input type="email"><input type="password" autocomplete="new-password"><input type="password" autocomplete="new-password"></form>'
    );

    expect(
      fillPage(
        { document: page, url: 'https://github.com/join', topIsSecure: true },
        REQUEST,
        NO_SHADOW
      )
    ).toBe('no-form');
    expect([...page.querySelectorAll('input')].every(input => input.value === '')).toBe(true);
  });

  it('never fills a field the browser does not draw on the page', () => {
    const page = aPage(
      '<form><input type="text" id="decoy"><input type="text" id="real"><input type="password"></form>'
    );
    const offPage = (input: HTMLInputElement) => input.id !== 'decoy';

    fillPage(
      { document: page, url: 'https://github.com/login', topIsSecure: true },
      REQUEST,
      NO_SHADOW,
      offPage
    );

    expect(page.querySelector<HTMLInputElement>('#decoy')?.value).toBe('');
    expect(page.querySelector<HTMLInputElement>('#real')?.value).toBe('jane');
  });
});
