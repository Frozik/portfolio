import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

import type { LandingFragments } from '../src/app/prerender/assemble-landing-html.ts';
import {
  assembleLandingHtml,
  extractRootMarkup,
  stripLandingHtml,
} from '../src/app/prerender/assemble-landing-html.ts';
import { deferEntryScripts } from '../src/app/prerender/defer-entry-scripts.ts';

/** Must match `scripts/prerender-landing.mjs`. */
const LANGUAGES = ['en', 'ru'] as const;
type Language = (typeof LANGUAGES)[number];
const INDEX_HTML = 'index.html';
/** GitHub Pages serves this for every unknown path; the app router takes over from there. */
const NOT_FOUND_HTML = '404.html';

/**
 * Puts the landing fragments rendered by `scripts/prerender-landing.mjs`
 * into `index.html`, and writes `404.html` without them: a deep link must
 * not paint the landing before the router draws its own page.
 */
export function prerenderedLanding({
  prerenderDir,
  outDir,
}: {
  readonly prerenderDir: string;
  readonly outDir: string;
}): Plugin {
  const fragmentPath = (language: Language): string =>
    resolve(prerenderDir, `landing.${language}.html`);
  /** The loader root of the page before the landing replaced it, for `404.html`. */
  let rootMarkup: string | undefined;

  return {
    name: 'prerendered-landing',
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const missing = LANGUAGES.filter(language => !existsSync(fragmentPath(language)));
        if (missing.length > 0) {
          throw new Error(
            `prerendered-landing: no fragment for ${missing.join(', ')} — run scripts/prerender-landing.mjs first`
          );
        }
        const fragments = Object.fromEntries(
          LANGUAGES.map(language => [language, readFileSync(fragmentPath(language), 'utf8')])
        ) satisfies LandingFragments;
        rootMarkup = extractRootMarkup(html);
        return deferEntryScripts(assembleLandingHtml(html, fragments));
      },
    },

    closeBundle: {
      sequential: true,
      handler() {
        if (rootMarkup === undefined) {
          throw new Error('prerendered-landing: index.html was not transformed before closeBundle');
        }
        const indexHtml = readFileSync(resolve(outDir, INDEX_HTML), 'utf8');
        writeFileSync(resolve(outDir, NOT_FOUND_HTML), stripLandingHtml(indexHtml, rootMarkup));
      },
    },
  };
}
