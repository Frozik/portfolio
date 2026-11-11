import { siteIconLinks } from './site-page-icons';

const PAGE = 'https://www.colins.ru/';

describe('the icons a site’s page names', () => {
  it('put a home-screen icon first, then the larger ones, resolved against the page', () => {
    const html = `
      <link rel="shortcut icon" type="image/x-icon" href="/images/favicon.ico">
      <link rel="icon" sizes="32x32" href="icons/32.png">
      <link rel='apple-touch-icon apple-touch-icon-precomposed' href='//cdn.colins.ru/touch.png'>
      <link rel="stylesheet" href="/site.css">`;

    expect(siteIconLinks(html, PAGE)).toEqual([
      'https://cdn.colins.ru/touch.png',
      'https://www.colins.ru/icons/32.png',
      'https://www.colins.ru/images/favicon.ico',
    ]);
  });

  it('pass over a vector, which the phone cannot draw', () => {
    const html = '<link rel="shortcut icon" type="image/x-icon" href="/local/images/favicon.svg">';

    expect(siteIconLinks(html, 'https://www.alfabank.by/')).toEqual([
      'https://www.alfabank.by/favicon.ico',
    ]);
  });

  it('fall back to the site’s favicon when the page names none', () => {
    expect(siteIconLinks('<html></html>', 'https://example.com/path?q=1')).toEqual([
      'https://example.com/favicon.ico',
    ]);
  });

  it('keep the query an icon’s address carries', () => {
    const html = '<link rel="icon" href="https://example.com/i.png?v=2&amp;s=64">';

    expect(siteIconLinks(html, 'https://example.com/')).toEqual([
      'https://example.com/i.png?v=2&s=64',
    ]);
  });
});
