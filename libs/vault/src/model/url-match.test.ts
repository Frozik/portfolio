import type { TFieldSpec } from './card';
import { changePasswordUrlOf } from './change-password-url';
import { describeHost } from './host-display';
import { successorsOf } from './shared-credentials';
import { matchUrl } from './url-match';

type TUrlSpec = Extract<TFieldSpec, { readonly kind: 'url' }>;
const rule = (match: TUrlSpec['match'], useSharedCredentials = true): TUrlSpec => ({
  kind: 'url',
  match,
  useSharedCredentials,
});

describe('matching a stored address to a page', () => {
  it.each([
    [
      'host',
      'https://accounts.example.com/login',
      'https://accounts.example.com/other?x=1',
      'direct',
    ],
    ['host', 'https://www.example.com', 'https://example.com:8443/', 'direct'],
    ['host', 'https://accounts.example.com', 'https://evil.example.com', null],
    ['host', 'https://example.com', 'http://example.com', 'direct'],
    ['base-domain', 'https://accounts.example.com', 'https://evil.example.com', 'direct'],
    ['base-domain', 'https://alice.github.io', 'https://mallory.github.io', null],
    ['base-domain', 'https://example.co.uk', 'https://shop.example.co.uk', 'direct'],
    ['exact', 'https://example.com/login?next=1', 'https://example.com/login#top', 'direct'],
    ['exact', 'https://example.com/login', 'https://example.com/login/other', null],
    ['starts-with', 'https://example.com/app', 'https://example.com/app/settings', 'direct'],
    ['starts-with', 'https://example.com/app', 'https://example.com/other', null],
    ['regex', '^https://(eu|us)\\.example\\.com/', 'https://eu.example.com/login', 'direct'],
    ['regex', '^https://(eu|us)\\.example\\.com/', 'https://asia.example.com/login', null],
    ['regex', '([unclosed', 'https://example.com/', null],
    ['never', 'https://example.com', 'https://example.com', null],
  ] as const)('%s: %s on %s → %s', (match, stored, page, expected) => {
    expect(matchUrl(stored, rule(match), page)).toBe(expected);
  });

  it('never matches a page that is not a web page', () => {
    expect(matchUrl('https://example.com', rule('host'), 'chrome://settings')).toBeNull();
    expect(matchUrl('https://example.com', rule('host'), 'not a url')).toBeNull();
  });

  it('refuses an overlong pattern instead of running it', () => {
    expect(matchUrl(`${'a'.repeat(257)}|.*`, rule('regex'), 'https://example.com/')).toBeNull();
  });

  it('offers logins of a shared group both ways and of a moved site only on its new domain', () => {
    expect(matchUrl('https://envato.com', rule('host'), 'https://themeforest.net/login')).toBe(
      'shared'
    );
    expect(matchUrl('https://themeforest.net', rule('host'), 'https://envato.com')).toBe('shared');
    expect(matchUrl('https://a2hosting.com', rule('host'), 'https://hosting.com')).toBe('shared');
    expect(matchUrl('https://hosting.com', rule('host'), 'https://a2hosting.com')).toBeNull();
  });

  it('ignores shared logins when the field says so, and for strict rules', () => {
    expect(
      matchUrl('https://envato.com', rule('host', false), 'https://themeforest.net')
    ).toBeNull();
    expect(matchUrl('https://envato.com', rule('exact'), 'https://themeforest.net')).toBeNull();
  });
});

describe('around a stored address', () => {
  it('names where an obsolete domain moved', () => {
    expect(successorsOf('angel.co')).toEqual(['wellfound.com']);
    expect(successorsOf('example.com')).toEqual([]);
  });

  it('links to the page that changes the password, or the well-known fallback', () => {
    expect(changePasswordUrlOf('https://www.google.com/')).toBe(
      'https://myaccount.google.com/signinoptions/password'
    );
    expect(changePasswordUrlOf('https://shop.example.com/login')).toBe(
      'https://shop.example.com/.well-known/change-password'
    );
    expect(changePasswordUrlOf('mailto:a@b.c')).toBeNull();
  });

  it('shows an international host in Unicode with its ASCII form beside it', () => {
    expect(describeHost('https://xn--80ak6aa92e.com/')).toEqual({
      unicode: 'аррӏе.com',
      punycode: 'xn--80ak6aa92e.com',
    });
    expect(describeHost('https://bücher.de/')).toEqual({
      unicode: 'bücher.de',
      punycode: 'xn--bcher-kva.de',
    });
    expect(describeHost('https://example.com/')).toEqual({
      unicode: 'example.com',
      punycode: null,
    });
  });
});
