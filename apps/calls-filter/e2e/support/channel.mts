import type { TAppDeath } from '@frozik/tooling/src/android-e2e/app-death.ts';
import { whyAppDied } from '@frozik/tooling/src/android-e2e/app-death.ts';
import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';
import { launch } from '@frozik/tooling/src/android-e2e/screen.ts';

export const PACKAGE = 'io.github.frozik.callsfilter';

const E2E_ACTION = 'io.github.frozik.callsfilter.E2E';
/** A cold start takes 6–10 s on a Mac; a hung app never answers at all. */
const APP_READY_MS = 60_000;
/** One start again per test: the system taking the app down twice is no accident any more. */
const SYSTEM_RESTARTS_PER_TEST = 1;

interface IAnswer {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

let systemRestartsLeft = 0;

/** A test begins: the app may be started again once if the system takes it down meanwhile. */
export function allowSystemRestart(): void {
  systemRestartsLeft = SYSTEM_RESTARTS_PER_TEST;
}

/** The answer's data, or undefined when nothing in the app received the command. */
async function broadcast(
  name: string,
  args: Readonly<Record<string, unknown>> = {}
): Promise<{ readonly output: string; readonly data: string | undefined }> {
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
  return { output, data: /data="([^"]*)"/.exec(output)?.[1] };
}

/** `pidof` fails when no process has the name. */
const running = () =>
  adb('shell', 'pidof', PACKAGE).then(
    pid => pid.trim() !== '',
    () => false
  );

const answers = async () => (await broadcast('ping')).data !== undefined;

async function start(): Promise<void> {
  await launch(PACKAGE);
  await waitFor('the app to answer after its start', answers, ready => ready, APP_READY_MS);
}

function deathText(death: TAppDeath): string {
  return death.kind === 'unknown' ? 'logcat does not say why' : `${death.kind}: ${death.reason}`;
}

/**
 * The app is gone. Started again only when the system took it down — Play services restarting on
 * a fresh emulator takes its clients with it — and only once a test; a crash of the app fails.
 */
async function startAgainAfter(name: string): Promise<void> {
  const death = whyAppDied(await adb('logcat', '-d', '-b', 'main,system,crash'), PACKAGE);
  if (death.kind !== 'killed-by-system' || systemRestartsLeft === 0) {
    throw new Error(`The app is gone while asked «${name}» (${deathText(death)})`);
  }
  systemRestartsLeft -= 1;
  process.stdout.write(`The system took the app down (${death.reason}); starting it again.\n`);
  await start();
}

/** One command to the app over its e2e channel, answered as JSON. */
export async function control<T>(
  name: string,
  args: Readonly<Record<string, unknown>> = {}
): Promise<T> {
  let { output, data } = await broadcast(name, args);
  if (data === undefined && !(await running())) {
    await startAgainAfter(name);
    ({ output, data } = await broadcast(name, args));
  }
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
  if (!(await answers())) {
    await start();
  }
}
