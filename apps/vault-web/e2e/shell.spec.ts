import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const INLINE_STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;

function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
}

test('the built page allows every inline script and style by hash, and nothing else inline', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const policy = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
  const inline = [...html.matchAll(INLINE_SCRIPT), ...html.matchAll(INLINE_STYLE)].map(match =>
    sha256(match[1] ?? '')
  );

  expect(inline.length).toBeGreaterThanOrEqual(3);
  for (const hash of inline) {
    expect(policy).toContain(hash);
  }
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toContain('cloudflareinsights');
});

test('a deep link opens the app from the fallback page', async ({ request }) => {
  const [page, fallback] = await Promise.all([request.get('/'), request.get('/404.html')]);

  expect(await fallback.text()).toBe(await page.text());
});

test('the app starts under its CSP with no violation', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      violations.push(message.text());
    }
  });
  await page.goto('/');

  await expect(page.getByTestId('no-vaults')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/unframed/);
  expect(violations).toEqual([]);
});

test('a framed page stays hidden', async ({ page }) => {
  await page.route('**/framing-page.html', route =>
    route.fulfill({ contentType: 'text/html', body: '<iframe src="/" title="framed"></iframe>' })
  );
  await page.goto('/framing-page.html');
  const framed = page.frameLocator('iframe').locator('html');

  await expect(framed).toHaveAttribute('data-theme', 'system');
  await expect(framed).not.toHaveClass(/unframed/);
  await expect(framed).toBeHidden();
});

test('a chosen scheme is applied before the first paint after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('appearance').getByRole('radio', { checked: true }).click();
  await page.getByTestId('appearance').locator('[data-value="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    'content',
    '#f9fafb'
  );
});
