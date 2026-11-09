import { randomInt } from 'node:crypto';

import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';
import { defineE2eTest } from '@frozik/tooling/src/android-e2e/e2e-test.ts';

import { allowSystemRestart, appReady, control } from './channel.mts';
import { AMSTERDAM, phoneAt } from './location.mts';

/** The service answers within milliseconds; a loaded CI emulator rings the call a few seconds late. */
const ANSWER_TIMEOUT_MS = 20_000;
/** The line must be idle again before the next call, or the emulator drops it. */
const IDLE_TIMEOUT_MS = 20_000;
const LOCAL_DIGITS = 10_000_000;

export interface IScreenedCall {
  readonly at: string;
  readonly verdict: 'passed' | 'rejected' | 'awaiting-repeat' | 'passed-as-repeat' | 'paused';
  /** The group's name, or `strangers` / `my-contacts` for the special two. */
  readonly group: string;
}

/** A number no other test has called: tests share the service's journal, never their numbers. */
export function freshNumber(): string {
  return `+3185${String(randomInt(LOCAL_DIGITS)).padStart(7, '0')}`;
}

async function screenedCalls(number: string): Promise<readonly IScreenedCall[]> {
  const calls = await control<readonly (IScreenedCall | { readonly verdict: null })[]>('calls', {
    number,
  });
  return calls.filter((call): call is IScreenedCall => call.verdict !== null);
}

async function lineIdle(): Promise<boolean> {
  const registry = await adb('shell', 'dumpsys', 'telephony.registry');
  return /mCallState=0/.test(registry);
}

/** A call from `number`, hung up as soon as the service has answered it; returns that answer. */
export async function call(number: string): Promise<IScreenedCall> {
  const before = (await screenedCalls(number)).length;
  await adb('emu', 'gsm', 'call', number);
  try {
    const calls = await waitFor(
      `the service's answer to ${number}`,
      () => screenedCalls(number),
      list => list.length > before,
      ANSWER_TIMEOUT_MS
    );
    const answer = calls[0];
    if (answer === undefined) {
      throw new Error(`No answer to ${number}`);
    }
    return answer;
  } finally {
    await adb('emu', 'gsm', 'cancel', number);
    await waitFor('the line to be idle', lineIdle, idle => idle, IDLE_TIMEOUT_MS);
  }
}

/** A test on the emulator, starting with the phone in Amsterdam and the app's book reset. */
export const e2eTest = defineE2eTest(async () => {
  allowSystemRestart();
  await phoneAt(AMSTERDAM);
  await appReady();
  await control('reset');
});
