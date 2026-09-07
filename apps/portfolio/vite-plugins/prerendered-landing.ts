import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

import type { Plugin } from 'vite';
import { build } from 'vite';

import type { LandingFragments } from '../src/app/prerender/assemble-landing-html.ts';
import {
  assembleLandingHtml,
  extractRootMarkup,
  stripLandingHtml,
} from '../src/app/prerender/assemble-landing-html.ts';
import { deferEntryScripts } from '../src/app/prerender/defer-entry-scripts.ts';

const LANGUAGES = ['en', 'ru'] as const;
const INDEX_HTML = 'index.html';
/** GitHub Pages serves this for every unknown path; the app router takes over from there. */
const NOT_FOUND_HTML = '404.html';
/** `renderToString` swallows a render error into this marker instead of throwing. */
const CLIENT_FALLBACK_MARKER = /<template data-msg="([^"]*)"/;

/**
 * Prerenders the landing as part of the browser build: an SSR build of the
 * render entry first, then one worker per language turning it into markup,
 * which `transformIndexHtml` puts into `index.html` with the entry scripts
 * deferred past the first paint. `404.html` gets the same page with the
 * loader root instead: a deep link must not paint the landing before the
 * router draws its own page.
 */
export function prerenderedLanding({
  renderEntry,
  entryFileName,
  prerenderDir,
  outDir,
}: {
  /** The module exporting `renderLanding()`, relative to the project root. */
  readonly renderEntry: string;
  /** Name the SSR build gives that module's bundle. */
  readonly entryFileName: string;
  readonly prerenderDir: string;
  readonly outDir: string;
}): Plugin {
  let configFile: string | undefined;
  let fragments: LandingFragments | undefined;
  /** The loader root of the page before the landing replaced it, for `404.html`. */
  let rootMarkup: string | undefined;

  return {
    name: 'prerendered-landing',
    apply: 'build',

    configResolved(config) {
      configFile = config.configFile;
    },

    async buildStart() {
      await build({
        configFile,
        logLevel: 'warn',
        build: { ssr: renderEntry, outDir: prerenderDir, emptyOutDir: true },
      });
      const bundlePath = resolve(prerenderDir, entryFileName);
      const rendered = await Promise.all(
        LANGUAGES.map(async language => [language, await renderInWorker(language, bundlePath)])
      );
      fragments = Object.fromEntries(rendered);
    },

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (fragments === undefined) {
          throw new Error('prerendered-landing: buildStart did not run before index.html');
        }
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

function renderInWorker(language: string, bundlePath: string): Promise<string> {
  return new Promise((resolveMarkup, reject) => {
    const worker = new Worker(new URL('./prerender-worker.ts', import.meta.url), {
      workerData: { language, bundlePath },
    });
    worker.once('message', (markup: string) => {
      const fallback = markup.match(CLIENT_FALLBACK_MARKER);
      if (fallback !== null) {
        reject(new Error(`prerender (${language}) fell back to client rendering: ${fallback[1]}`));
        return;
      }
      resolveMarkup(markup);
    });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code !== 0) {
        reject(new Error(`prerender worker (${language}) exited with code ${code}`));
      }
    });
  });
}
