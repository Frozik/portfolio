import { afterEach, describe, expect, it } from 'vitest';

import type { IErrorEntry } from '../core/report';
import { FIXTURE_TIME } from '../testing/report-fixture';
import { captureErrors } from './errors';

const now = () => FIXTURE_TIME;

describe('captureErrors', () => {
  let restore: (() => void) | undefined;
  const entries: IErrorEntry[] = [];

  afterEach(() => {
    restore?.();
    entries.length = 0;
  });

  it('records an uncaught exception with its stack and location', () => {
    restore = captureErrors(entry => entries.push(entry), now);
    const error = new Error('boom');

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', error, filename: 'app.js', lineno: 3, colno: 7 })
    );

    expect(entries[0]).toMatchObject({ kind: 'uncaught', message: 'boom', source: 'app.js:3:7' });
    expect(entries[0]?.stack).toContain('boom');
  });

  it('normalises a rejection whose reason is not an Error', () => {
    restore = captureErrors(entry => entries.push(entry), now);

    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: { code: 'E_TIMEOUT' } })
    );

    expect(entries[0]).toMatchObject({
      kind: 'unhandledrejection',
      message: '{code: "E_TIMEOUT"}',
    });
  });

  it('stops listening once restored', () => {
    restore = captureErrors(entry => entries.push(entry), now);
    restore();
    restore = undefined;

    window.dispatchEvent(new ErrorEvent('error', { message: 'late' }));

    expect(entries).toHaveLength(0);
  });
});
