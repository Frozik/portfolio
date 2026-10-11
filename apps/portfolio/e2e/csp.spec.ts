import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

// The page's own CSP, a `<meta>` (GitHub Pages sets no headers):
// an injected inline script does not run and markup strings are refused, while
// the page's own scripts — allowed by their hashes — did run, or it would not be ready.
test('the built page runs only its own scripts and refuses markup strings', async ({ page }) => {
  await page.goto('');
  await waitForApp(page);

  await page.addScriptTag({ content: 'window.injectedScriptRan = true;' }).catch(() => null);
  const outcome = await page.evaluate(() => {
    let markupRefused = false;
    try {
      document.createElement('div').innerHTML = '<b>injected</b>';
    } catch {
      markupRefused = true;
    }
    return { injectedScriptRan: 'injectedScriptRan' in window, markupRefused };
  });

  expect(outcome).toEqual({ injectedScriptRan: false, markupRefused: true });
});
