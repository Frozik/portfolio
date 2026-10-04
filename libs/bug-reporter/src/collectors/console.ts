import type { TNow } from '../core/clock';
import type { IConsoleEntry, TConsoleLevel } from '../core/report';
import { formatConsoleArguments } from '../core/safe-serialize';

const LEVELS: readonly TConsoleLevel[] = ['debug', 'log', 'info', 'warn', 'error'];

type TConsoleMethod = (...args: unknown[]) => void;

/**
 * Mirrors every console line into `push` while DevTools keeps printing it
 * from the original method, so call sites keep their source locations.
 */
export function captureConsole(push: (entry: IConsoleEntry) => void, now: TNow): () => void {
  let recording = false;
  const restores = LEVELS.map(level => {
    const original: TConsoleMethod = console[level];
    const wrapped: TConsoleMethod = (...args) => {
      original.apply(console, args);
      if (recording) {
        return;
      }
      recording = true;
      try {
        push({ timestamp: now(), level, message: formatConsoleArguments(args), count: 1 });
      } finally {
        recording = false;
      }
    };
    console[level] = wrapped;
    return () => {
      if (console[level] === wrapped) {
        console[level] = original;
      }
    };
  });
  return () => {
    for (const restore of restores) {
      restore();
    }
  };
}

export function coalesceConsole(
  last: IConsoleEntry,
  next: IConsoleEntry
): IConsoleEntry | undefined {
  return last.level === next.level && last.message === next.message
    ? { ...last, count: last.count + next.count }
    : undefined;
}
