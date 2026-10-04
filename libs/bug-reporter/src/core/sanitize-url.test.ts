import { describe, expect, it } from 'vitest';

import { sanitizeUrl } from './sanitize-url';

const PAGE = 'https://app.test/portfolio/bug-reporter';

describe('sanitizeUrl', () => {
  it('keeps origin and path only', () => {
    expect(sanitizeUrl('https://api.test/a/b?x=1#frag', PAGE)).toBe('https://api.test/a/b');
  });

  it('resolves a relative address against the page', () => {
    expect(sanitizeUrl('/api/quotes?x=1', PAGE)).toBe('https://app.test/api/quotes');
  });

  it('still strips the query when the address does not parse', () => {
    expect(sanitizeUrl('not a url?token=1', 'also not a url')).toBe('not a url');
  });
});
