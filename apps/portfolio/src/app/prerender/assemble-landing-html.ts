/** The markup `index.html` ships for the root before the prerender replaces it. */
const ROOT_PATTERN = /<div id="root">[\s\S]*?<\/div>\s*<\/div>/;
const PRERENDER_START = '<!--prerender-->';
const PRERENDER_END = '<!--/prerender-->';
const PRERENDER_BLOCK_PATTERN = new RegExp(`${PRERENDER_START}[\\s\\S]*?${PRERENDER_END}`);

/** Rendered landing markup keyed by language code, as `scripts/prerender-landing.mjs` writes it. */
export type LandingFragments = Readonly<Record<string, string>>;

/** Attribute the browser bootstrap uses to find the fragment of its language. */
export const PRERENDER_ATTRIBUTE = 'data-prerender';

/**
 * Puts one prerendered root per language into the page. The inline script in
 * the head sets `<html lang>` before the body parses, and the style below
 * hides the fragment of the other language from the first paint on;
 * `main.tsx` then removes it and hydrates the survivor.
 */
export function assembleLandingHtml(html: string, fragments: LandingFragments): string {
  const roots = Object.entries(fragments)
    .map(
      ([language, markup]) =>
        `<div id="root-${language}" ${PRERENDER_ATTRIBUTE}="${language}" lang="${language}">${markup}</div>`
    )
    .join('');
  const style =
    `<style>` +
    `html[lang="en"] [${PRERENDER_ATTRIBUTE}="ru"],html[lang="ru"] [${PRERENDER_ATTRIBUTE}="en"]{display:none}` +
    `</style>`;
  const block = `${PRERENDER_START}${style}${roots}${PRERENDER_END}`;
  const assembled = html.replace(ROOT_PATTERN, block);
  if (assembled === html) {
    throw new Error('assembleLandingHtml: the root container was not found in index.html');
  }
  return assembled;
}

/** The root as `index.html` ships it — the loader a page without a prerender shows. */
export function extractRootMarkup(html: string): string {
  const root = html.match(ROOT_PATTERN);
  if (root === null) {
    throw new Error('extractRootMarkup: the root container was not found in index.html');
  }
  return root[0];
}

/** The same page with the loader root back in place of the prerendered landing — a deep link's `404.html`. */
export function stripLandingHtml(html: string, rootMarkup: string): string {
  return html.replace(PRERENDER_BLOCK_PATTERN, rootMarkup);
}
