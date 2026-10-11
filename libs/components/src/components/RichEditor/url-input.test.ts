import { normalizeUrlInput, urlSegments } from './url-input';

const names = { dim: 'dim', host: 'host' };
const bright = (text: string): string | undefined =>
  urlSegments(text, names).find(segment => segment.className === 'host')?.text;

describe('url input', () => {
  it.each([
    ['https://accounts.example.com/login?next=1', 'accounts.example.com'],
    ['https://bank.example@evil.example/login', 'evil.example'],
    ['http://localhost:8080/admin', 'localhost'],
    ['example.com/path', 'example.com'],
    ['https://user:pass@host.example:443', 'host.example'],
  ])('shows the host of %s bright: %s', (url, host) => {
    expect(bright(url)).toBe(host);
  });

  it('keeps the whole text, only split into parts', () => {
    const url = 'https://bank.example@evil.example:8443/a?b#c';

    expect(
      urlSegments(url, names)
        .map(segment => segment.text)
        .join('')
    ).toBe(url);
  });

  it('drops spaces and keeps the caret with its characters', () => {
    expect(normalizeUrlInput('exa mple.com', { start: 12, end: 12 })).toEqual({
      value: 'example.com',
      selection: { start: 11, end: 11 },
    });
  });
});
