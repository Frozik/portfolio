import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { openFromDrive } from './open-vault';

/** WCAG 1.4.10: content reflows at 320 CSS px — a 1280 px window at 400 %, or 640 px at 200 %. */
const NARROWEST = { width: 320, height: 640 };

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(0);
}

test.use({ viewport: NARROWEST });

test('every screen reflows into 320 px without scrolling sideways', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/');
  await expectNoSidewaysScroll(page);

  await openFromDrive(context, page);
  await expectNoSidewaysScroll(page);

  await page.getByTestId('card-row').first().click();
  await expect(page.getByTestId('card')).toBeVisible();
  await expectNoSidewaysScroll(page);

  for (const tab of ['tab-audit', 'tab-settings']) {
    await page.getByTestId(tab).click();
    await expectNoSidewaysScroll(page);
  }
});
