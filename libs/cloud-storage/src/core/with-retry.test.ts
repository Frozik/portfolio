import type { Milliseconds } from '@frozik/utils/date/types';
import { err } from '@frozik/utils/result/result';

import { createMemoryProvider } from '../memory/memory-provider';
import type { TStorageError } from './storage-error';
import { storagePath } from './storage-path';
import type { IStorageProvider } from './storage-provider';
import { withRetry } from './with-retry';

const SIGNAL = new AbortController().signal;
const FILE = storagePath('Vault/main.pwv');

function failingFirst(errors: readonly TStorageError[]): IStorageProvider {
  const memory = createMemoryProvider();
  let calls = 0;
  return {
    ...memory,
    stat: (path, signal) => {
      calls += 1;
      const error = errors[calls - 1];
      return error === undefined ? memory.stat(path, signal) : Promise.resolve(err(error));
    },
  };
}

describe('storage retries', () => {
  it('waits longer each time a call may pass later, and honours Retry-After', async () => {
    const delays: Milliseconds[] = [];
    const provider = withRetry(
      failingFirst([
        { kind: 'offline' },
        { kind: 'server', status: 503 },
        { kind: 'rate-limited', retryAfter: 7000 as Milliseconds },
      ]),
      {
        random: () => 1,
        wait: async delay => {
          delays.push(delay);
          return true;
        },
      }
    );

    expect(await provider.stat(FILE, SIGNAL)).toEqual({ ok: true, value: null });
    expect(delays).toEqual([1000, 2000, 7000]);
  });

  it('gives up after four attempts and passes on what the provider said', async () => {
    const provider = withRetry(
      failingFirst(Array.from({ length: 4 }, () => ({ kind: 'offline' as const }))),
      {
        wait: async () => true,
      }
    );

    expect(await provider.stat(FILE, SIGNAL)).toEqual({ ok: false, error: { kind: 'offline' } });
  });

  it('never repeats what a repeat cannot change', async () => {
    const wait = vi.fn(async () => true);
    const provider = withRetry(failingFirst([{ kind: 'auth-required' }]), { wait });

    expect(await provider.stat(FILE, SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'auth-required' },
    });
    expect(wait).not.toHaveBeenCalled();
  });

  it('stops waiting as soon as the caller aborts', async () => {
    const controller = new AbortController();
    const provider = withRetry(failingFirst([{ kind: 'offline' }]));

    const pending = provider.stat(FILE, controller.signal);
    controller.abort();

    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
  });
});
