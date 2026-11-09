import { escapeRegExp } from 'lodash-es';

/**
 * Why an app's process is gone. A test may start the app again only when the system took it
 * down — Play services restarting on a fresh emulator takes its clients with it, or memory ran
 * out — never when the app crashed or something stopped it: those are what a test must show.
 */
export type TAppDeath =
  | { readonly kind: 'killed-by-system'; readonly reason: string }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'stopped'; readonly reason: string }
  | { readonly kind: 'unknown' };

/** Reads `adb logcat -d` since the app's last start. */
export function whyAppDied(logcat: string, packageName: string): TAppDeath {
  const name = escapeRegExp(packageName);
  const lines = logcat.split('\n');
  const started = lines.findLastIndex(line =>
    new RegExp(`ActivityManager: Start proc \\d+:${name}/`).test(line)
  );
  const since = lines.slice(Math.max(started, 0)).join('\n');
  const crashed =
    new RegExp(`FATAL EXCEPTION:.*\\n.*Process: ${name},`).exec(since) ??
    new RegExp(`ANR in ${name}\\b.*`).exec(since);
  if (crashed !== null) {
    return { kind: 'crashed', reason: crashed[0].trim() };
  }
  const outOfMemory = new RegExp(`lowmemorykiller: Kill '${name}'.*`).exec(since);
  if (outOfMemory !== null) {
    return { kind: 'killed-by-system', reason: outOfMemory[0].trim() };
  }
  const killed = [
    ...since.matchAll(
      new RegExp(`ActivityManager: Killing \\d+:${name}/\\S+ \\(adj -?\\d+\\): (.*)`, 'g')
    ),
  ].at(-1);
  if (killed === undefined) {
    return { kind: 'unknown' };
  }
  const reason = (killed[1] ?? '').trim();
  return /^depends on .* in dying proc /.test(reason)
    ? { kind: 'killed-by-system', reason }
    : { kind: 'stopped', reason };
}
