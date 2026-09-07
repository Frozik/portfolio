import { describe, expect, it } from 'vitest';

import { selectRootContainer, shouldHydrate } from './root-container';

function documentWith(body: string): Document {
  const parsed = document.implementation.createHTMLDocument('');
  parsed.body.innerHTML = body;
  return parsed;
}

const PRERENDERED =
  '<div id="root-en" data-prerender="en"><main>Hello</main></div>' +
  '<div id="root-ru" data-prerender="ru"><main>Привет</main></div>';

describe('selectRootContainer', () => {
  it('keeps the fragment of the language, drops the other and makes it the root', () => {
    const page = documentWith(PRERENDERED);

    const container = selectRootContainer(page, 'ru');

    expect(container.isPrerendered).toBe(true);
    expect(container.element.id).toBe('root');
    expect(container.element.textContent).toBe('Привет');
    expect(page.querySelectorAll('[data-prerender]')).toHaveLength(1);
  });

  it('falls back to the plain root of a page that was not prerendered', () => {
    const page = documentWith('<div id="root"></div>');

    const container = selectRootContainer(page, 'en');

    expect(container.isPrerendered).toBe(false);
    expect(container.element.id).toBe('root');
  });

  it('fails loudly when the page has no root at all', () => {
    expect(() => selectRootContainer(documentWith('<p></p>'), 'en')).toThrow(/root/);
  });
});

describe('shouldHydrate', () => {
  const prerendered = { element: document.createElement('div'), isPrerendered: true };

  it('hydrates the prerendered landing on the landing path only', () => {
    expect(shouldHydrate(prerendered, '/portfolio/', '/portfolio')).toBe(true);
    expect(shouldHydrate(prerendered, '/portfolio', '/portfolio')).toBe(true);
    expect(shouldHydrate(prerendered, '/portfolio/sudoku', '/portfolio')).toBe(false);
  });

  it('never hydrates a root that holds no prerendered markup', () => {
    expect(
      shouldHydrate({ ...prerendered, isPrerendered: false }, '/portfolio/', '/portfolio')
    ).toBe(false);
  });
});
