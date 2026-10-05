import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Waits until React has committed (`useAppReadyMarker`): before that the
 * prerendered landing shows buttons that do not respond yet, and a click
 * lands nowhere — on a slow CI runner, often.
 */
export async function waitForApp(page: Page): Promise<void> {
  await expect(page.locator('html[data-app-ready]')).toHaveCount(1);
}
