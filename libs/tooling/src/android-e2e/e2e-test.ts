import type { TestContext } from 'node:test';
import { test } from 'node:test';

import { keepEvidence } from './device.ts';

/** node:test's own limit sits past the test's, so the test's own failure — with evidence — wins. */
const RUNNER_GRACE_MS = 15_000;

/** Runs `work`, failing once it has run `limitMs`: a hang fails the test instead of the run. */
export async function within<T>(work: Promise<T>, limitMs: number, name: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`«${name}» still ran after ${limitMs} ms`)), limitMs);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The `e2eTest` of an app: `prepare` puts the phone and the app in the state every test starts
 * from, `limitMs` bounds a test as a hang guard (not a speed budget), and whatever fails leaves
 * the screen, the view tree and logcat.
 */
export function defineE2eTest(prepare: () => Promise<void>) {
  return (name: string, limitMs: number, body: (context: TestContext) => Promise<void>): void => {
    test(name, { timeout: limitMs + RUNNER_GRACE_MS }, async context => {
      try {
        await prepare();
        await within(body(context), limitMs, name);
      } catch (error: unknown) {
        await keepEvidence(name);
        throw error;
      }
    });
  };
}
