import { browser } from 'wxt/browser';

import type { IIdleAlarm } from '../domain/ports';

export const IDLE_ALARM = 'idle-lock';
const MS_PER_MINUTE = 60_000;

/** `chrome.alarms` survives the worker's sleep; the worker answers it by locking. */
export const CHROME_IDLE_ALARM: IIdleAlarm = {
  async set(delayMs) {
    await browser.alarms.create(IDLE_ALARM, { delayInMinutes: delayMs / MS_PER_MINUTE });
  },
  async cancel() {
    await browser.alarms.clear(IDLE_ALARM);
  },
};
