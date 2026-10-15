import { expect, test } from '@playwright/test';

import { FIXTURE_CARDS } from './fixture-vault';
import { openFromDrive } from './open-vault';

test('a new card made from a template is saved into the list; an edit shows in its history', async ({
  context,
}) => {
  const page = await openFromDrive(context);

  await page.getByTestId('new-card').getByRole('combobox').click();
  await page.getByRole('option').first().click();
  const editor = page.getByTestId('card-editor');
  await editor.getByRole('textbox').first().fill('Router');
  await editor.getByTestId('editor-save').click();
  await expect(page.getByTestId('card').getByRole('heading')).toHaveText('Router');

  await page.getByTestId('edit-card').click();
  await editor.getByRole('textbox').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Home router');
  await editor.getByTestId('editor-save').click();
  await expect(page.getByTestId('card').getByRole('heading')).toHaveText('Home router');
  await page.getByTestId('card-history').click();
  await expect(page.getByTestId('revision-changes').first()).toBeVisible();

  await page.getByTestId('tab-vault').click();
  await expect(page.getByTestId('card-row')).toHaveCount(FIXTURE_CARDS + 1);
});

test('a card takes a built-in icon in a colour, offered only once an icon is chosen, and shows it', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await page.getByTestId('card-row').first().click();
  await page.getByTestId('edit-card').click();
  const appearance = page.getByTestId('card-appearance');
  await expect(appearance.getByRole('combobox')).toHaveCount(1);

  await appearance.getByRole('combobox').first().click();
  await page.locator('[role="option"][data-value="wifi"]').click();
  await appearance.getByRole('combobox').nth(1).click();
  await page.locator('[role="option"][data-value="teal"]').click();
  await page.getByTestId('card-editor').getByTestId('editor-save').click();

  const icon = page.getByTestId('card').locator('[data-icon]').first();
  await expect(icon).toHaveAttribute('data-icon', 'wifi');
  await expect(icon).toHaveAttribute('data-color', 'teal');
});
