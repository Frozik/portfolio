import { describe, expect, it } from 'vitest';

import { assembleLandingHtml, extractRootMarkup, stripLandingHtml } from './assemble-landing-html';

const HTML = `<html lang="en"><body>
    <div id="root">
      <div id="initial-loader"><svg></svg></div>
    </div>
    <script type="module" src="/x.js"></script>
  </body></html>`;

const FRAGMENTS = { en: '<main>Hello</main>', ru: '<main>Привет</main>' };

describe('assembleLandingHtml', () => {
  it('replaces the loader root with one prerendered root per language', () => {
    const html = assembleLandingHtml(HTML, FRAGMENTS);

    expect(html).not.toContain('initial-loader');
    expect(html).toContain(
      '<div id="root-en" data-prerender="en" lang="en"><main>Hello</main></div>'
    );
    expect(html).toContain(
      '<div id="root-ru" data-prerender="ru" lang="ru"><main>Привет</main></div>'
    );
    expect(html).toContain('<script type="module" src="/x.js"></script>');
  });

  it('hides the fragment of the other language from the first paint on', () => {
    expect(assembleLandingHtml(HTML, FRAGMENTS)).toContain(
      'html[lang="en"] [data-prerender="ru"],html[lang="ru"] [data-prerender="en"]{display:none}'
    );
  });

  it('refuses a page without the root container', () => {
    expect(() => assembleLandingHtml('<body></body>', FRAGMENTS)).toThrow(/root container/);
  });

  it('puts the loader root back in place of the prerendered landing for deep links', () => {
    const stripped = stripLandingHtml(
      assembleLandingHtml(HTML, FRAGMENTS),
      extractRootMarkup(HTML)
    );

    expect(stripped).toContain('<div id="initial-loader"><svg></svg></div>');
    expect(stripped).not.toContain('data-prerender');
    expect(stripped).not.toContain('Привет');
  });
});
