import { afterEach, describe, expect, it, vi } from 'vitest';

import type { INetworkEntry } from '../core/report';
import { FIXTURE_TIME } from '../testing/report-fixture';
import { captureNetwork } from './network';

const now = () => FIXTURE_TIME;

describe('captureNetwork', () => {
  const entries: INetworkEntry[] = [];
  let restore: (() => void) | undefined;
  const originalFetch = window.fetch;

  afterEach(() => {
    restore?.();
    window.fetch = originalFetch;
    entries.length = 0;
  });

  it('records a fetch without its query string and hands the caller the original promise', async () => {
    const response = new Response('{}', { status: 404 });
    window.fetch = vi.fn().mockResolvedValue(response);
    restore = captureNetwork(entry => entries.push(entry), now);

    const result = await fetch('https://api.test/quotes?token=secret', { method: 'post' });
    await Promise.resolve();

    expect(result).toBe(response);
    expect(entries[0]).toMatchObject({
      transport: 'fetch',
      method: 'POST',
      url: 'https://api.test/quotes',
      status: 404,
      failed: true,
    });
  });

  it('marks a network failure without swallowing the rejection', async () => {
    window.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    restore = captureNetwork(entry => entries.push(entry), now);

    await expect(fetch('https://api.test/down')).rejects.toThrow('Failed to fetch');
    await Promise.resolve();

    expect(entries[0]).toMatchObject({ status: null, failed: true });
  });

  it('puts the original fetch back on restore', () => {
    const patched = vi.fn();
    window.fetch = patched;
    restore = captureNetwork(() => undefined, now);
    restore();
    restore = undefined;

    expect(window.fetch).toBe(patched);
  });
});
