import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';

export const PACKAGE = 'io.github.frozik.callsfilter';

const E2E_ACTION = 'io.github.frozik.callsfilter.E2E';
/** A cold start takes 6–10 s on a Mac; a hung app never answers at all. */
const APP_READY_MS = 60_000;

interface IAnswer {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/** One command to the app over its e2e channel, answered as JSON. */
export async function control<T>(
  name: string,
  args: Readonly<Record<string, unknown>> = {}
): Promise<T> {
  const payload = Buffer.from(JSON.stringify({ name, ...args })).toString('base64');
  const output = await adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    E2E_ACTION,
    '-p',
    PACKAGE,
    '--es',
    'payload',
    payload
  );
  const data = /data="([^"]*)"/.exec(output)?.[1];
  if (data === undefined) {
    throw new Error(`The app did not answer «${name}»: ${output.trim()}`);
  }
  const answer = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as IAnswer;
  if (!answer.ok) {
    throw new Error(`«${name}» failed in the app: ${answer.error ?? 'no reason'}`);
  }
  return answer.result as T;
}

/** The app up and answering: started if it is not running (a revoked permission kills it). */
export async function appReady(): Promise<void> {
  const answers = () =>
    control('ping').then(
      () => true,
      () => false
    );
  if (await answers()) {
    return;
  }
  await adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1');
  await waitFor('the app to answer after its start', answers, ready => ready, APP_READY_MS);
}
