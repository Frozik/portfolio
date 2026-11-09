import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { dumpViewTree } from './agent.ts';

/** Where a run leaves what a failed test saw; the runner script clears it and CI uploads it. */
const ARTIFACTS = 'e2e-artifacts';
/** One adb command never takes this long unless the emulator is gone. */
const ADB_TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
/** Enough of a failed tool's output to see the step it failed on. */
const OUTPUT_TAIL_LINES = 15;
const POLL_MS = 100;

function exec(
  file: string,
  args: readonly string[],
  timeout: number
): Promise<{ readonly stdout: Buffer; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout, encoding: 'buffer', maxBuffer: OUTPUT_LIMIT_BYTES, killSignal: 'SIGKILL' },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ stdout, stderr: stderr.toString() });
        } else {
          const output = `${stdout.toString()}${stderr.toString()}`.trim().split('\n');
          reject(new Error(`${file} failed: ${output.slice(-OUTPUT_TAIL_LINES).join('\n')}`));
        }
      }
    );
  });
}

export async function adb(...args: readonly string[]): Promise<string> {
  return (await exec('adb', args, ADB_TIMEOUT_MS)).stdout.toString();
}

/** Waits for what a test expects to happen; `timeoutMs` only bounds a wait for an event. */
export async function waitFor<T>(
  what: string,
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs: number
): Promise<T> {
  const until = performance.now() + timeoutMs;
  let last: T = await read();
  while (!done(last)) {
    if (performance.now() > until) {
      throw new Error(
        `Gave up waiting for ${what} after ${timeoutMs} ms; last seen: ${JSON.stringify(last)}`
      );
    }
    await delay(POLL_MS);
    last = await read();
  }
  return last;
}

/** What the phone showed when a test failed: the screen, the view tree and logcat. */
export async function keepEvidence(name: string): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  const base = join(ARTIFACTS, name.replace(/[^\w-]+/g, '-'));
  const saved = await Promise.allSettled([
    exec('adb', ['exec-out', 'screencap', '-p'], ADB_TIMEOUT_MS).then(({ stdout }) =>
      writeFile(`${base}.png`, stdout)
    ),
    dumpViewTree().then(xml => writeFile(`${base}.xml`, xml)),
    adb('logcat', '-d', '-t', '3000').then(log => writeFile(`${base}.logcat.txt`, log)),
  ]);
  const missed = saved.filter(result => result.status === 'rejected').length;
  process.stderr.write(
    `Evidence of «${name}» in ${base}.*${missed === 0 ? '' : ` (${missed} could not be read)`}\n`
  );
}
