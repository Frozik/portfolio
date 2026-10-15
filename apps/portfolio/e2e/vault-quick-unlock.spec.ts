import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const DEMO_PASSWORD = 'demo';
/** Past the default five idle minutes and the next fifteen-second check. */
const IDLE_PAST_LOCK = '05:30';

async function openDemoWithFakeClock(page: Page): Promise<string> {
  await page.clock.install();
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();
  return page.url();
}

async function setUpQuickUnlock(page: Page, kind: 'pin' | 'pattern'): Promise<void> {
  await page.getByRole('link', { name: 'Settings' }).click();
  const panel = page.getByTestId('quick-unlock-panel');
  await panel.getByTestId('quick-unlock-set-up').click();
  const password = panel.locator('input[type="password"]');
  await password.fill(DEMO_PASSWORD);
  await password.press('Enter');
  await panel.getByTestId('quick-unlock-kinds').locator(`[data-kind="${kind}"]`).click();
  for (const step of ['enter', 'confirm']) {
    const entry = panel.locator(`[data-testid="quick-unlock-entry"][data-state="${step}"]`);
    if (kind === 'pin') {
      const pin = entry.locator('input');
      await pin.fill('2468');
      await pin.press('Enter');
    } else {
      await drawPattern(page, entry.getByTestId('pattern-pad'));
    }
  }
  await expect(panel.getByTestId('quick-unlock-status')).toHaveAttribute('data-state', kind);
}

/** An L: the top row left to right, then down the right column, with the keyboard. */
async function drawPattern(page: Page, pad: ReturnType<Page['getByTestId']>): Promise<void> {
  await pad.getByRole('button').first().focus();
  for (const key of ['Space', 'ArrowRight', 'Space', 'ArrowRight', 'Space', 'ArrowDown', 'Space']) {
    await page.keyboard.press(key);
  }
  await page.keyboard.press('Enter');
}

/** Back in the vault inside the page (a reload would be a full lock), then idle past the lock. */
async function idleIntoQuickLock(page: Page, vaultUrl: string): Promise<void> {
  await page.goBack();
  await expect(page).toHaveURL(vaultUrl);
  await page.clock.fastForward(IDLE_PAST_LOCK);
  await expect(page.getByTestId('quick-unlock')).toBeVisible();
}

test('a PIN opens a vault the idle lock closed, without the master password', async ({ page }) => {
  const vaultUrl = await openDemoWithFakeClock(page);
  await setUpQuickUnlock(page, 'pin');
  await idleIntoQuickLock(page, vaultUrl);

  await page.keyboard.type('2468');

  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();
});

test('a pattern opens a vault the idle lock closed', async ({ page }) => {
  const vaultUrl = await openDemoWithFakeClock(page);
  await setUpQuickUnlock(page, 'pattern');
  await idleIntoQuickLock(page, vaultUrl);

  await drawPattern(page, page.getByTestId('quick-unlock').getByTestId('pattern-pad'));

  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();
});

test('a wrong code is the one try: the master password is asked for, and says why', async ({
  page,
}) => {
  const vaultUrl = await openDemoWithFakeClock(page);
  await setUpQuickUnlock(page, 'pin');
  await idleIntoQuickLock(page, vaultUrl);

  await page.keyboard.type('1111');

  await expect(page.getByTestId('unlock-notice')).toBeVisible();
  await expect(page.getByTestId('quick-unlock')).toBeHidden();
});

test('the vault paints light when chosen, inside the dark portfolio', async ({ page }) => {
  await page.goto('vault');
  await waitForApp(page);

  await page.getByTestId('appearance').getByRole('radio', { checked: true }).click();
  await page.getByTestId('appearance').locator('[data-value="light"]').click();

  const root = page.locator('[data-theme="light"]');
  await expect(root).toBeVisible();
  await expect(root).toHaveCSS('background-color', 'rgb(249, 250, 251)');
  await expect(page.getByTestId('appearance')).toHaveAttribute('data-state', 'light');
});

test('controls and their popups follow the vault’s light theme on a dark system', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('vault');
  await waitForApp(page);
  await page.getByTestId('appearance').getByRole('radio', { checked: true }).click();
  await page.getByTestId('appearance').locator('[data-value="light"]').click();
  await page.getByRole('button', { name: 'Try the demo' }).click();

  const white = 'rgb(255, 255, 255)';
  const lightCard = page.getByRole('textbox', { name: 'Search' });
  await lightCard.blur();
  await expect(lightCard).toHaveCSS('background-color', white);
  const sort = page.getByRole('combobox', { name: 'Sort' });
  await expect(sort).toHaveCSS('background-color', white);
  await sort.click();
  const options = page.locator(`[id="${await sort.getAttribute('aria-controls')}"]`);
  await expect(options).toHaveCSS('color', 'rgb(17, 24, 39)');
});

test('the theme stays in its corner while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.goto('vault');
  await waitForApp(page);
  const theme = page.getByTestId('appearance');
  const before = await theme.boundingBox();

  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() =>
      page
        .locator('main')
        .first()
        .evaluate(main => main.scrollTop)
    )
    .toBeGreaterThan(0);

  expect(await theme.boundingBox()).toEqual(before);
});
