#!/usr/bin/env node
// Renders the landing to static HTML once per language, from the SSR bundle
// that `vite build --ssr` left in `.prerender/`. Translations resolve at module
// load from `navigator.language`, so every language gets a process of its own.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LANGUAGES = ['en', 'ru'];
const RENDER_FLAG = '--render';
const scriptPath = fileURLToPath(import.meta.url);
const prerenderDir = resolve(dirname(scriptPath), '..', '.prerender');

const [, , flag, language] = process.argv;

if (flag === RENDER_FLAG) {
  await renderLanguage(language);
} else {
  for (const each of LANGUAGES) {
    execFileSync(process.execPath, [scriptPath, RENDER_FLAG, each], { stdio: 'inherit' });
  }
}

async function renderLanguage(target) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: target },
    configurable: true,
  });
  const { renderLanding } = await import(
    pathToFileURL(resolve(prerenderDir, 'render-landing.js')).href
  );
  const markup = renderLanding();
  // `renderToString` swallows a render error into a "switch to client rendering"
  // marker; a landing that would only paint after the scripts is a broken build.
  const clientFallback = markup.match(/<template data-msg="([^"]*)"/);
  if (clientFallback) {
    throw new Error(`prerender (${target}) fell back to client rendering: ${clientFallback[1]}`);
  }
  const outputPath = resolve(prerenderDir, `landing.${target}.html`);
  writeFileSync(outputPath, markup);
}
