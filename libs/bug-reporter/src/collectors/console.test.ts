/* oxlint-disable no-console -- the subject under test is the console itself */
import { describe, expect, it, vi } from 'vitest';

import type { IConsoleEntry } from '../core/report';
import { FIXTURE_TIME } from '../testing/report-fixture';
import { captureConsole, coalesceConsole } from './console';

const now = () => FIXTURE_TIME;

describe('captureConsole', () => {
  it('records the line and still prints it through the original method', () => {
    const entries: IConsoleEntry[] = [];
    const original = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const restore = captureConsole(entry => entries.push(entry), now);

    console.warn('low balance', { account: 42 });

    expect(entries).toEqual([
      { timestamp: FIXTURE_TIME, level: 'warn', message: 'low balance {account: 42}', count: 1 },
    ]);
    expect(original).toHaveBeenCalledWith('low balance', { account: 42 });
    restore();
    original.mockRestore();
  });

  it('puts the original methods back on restore and leaves a later patch alone', () => {
    const originalLog = console.log;
    const restore = captureConsole(() => undefined, now);
    const laterPatch = vi.fn();
    console.log = laterPatch;

    restore();

    expect(console.log).toBe(laterPatch);
    console.log = originalLog;
  });

  it('does not record its own output recursively when the sink logs', () => {
    const entries: IConsoleEntry[] = [];
    const original = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const restore = captureConsole(entry => {
      entries.push(entry);
      console.info('sink echo');
    }, now);

    console.info('once');

    expect(entries).toHaveLength(1);
    restore();
    original.mockRestore();
  });

  it('folds a repeated identical line into a count', () => {
    const line: IConsoleEntry = {
      timestamp: FIXTURE_TIME,
      level: 'log',
      message: 'tick',
      count: 1,
    };
    expect(coalesceConsole(line, line)).toEqual({ ...line, count: 2 });
    expect(coalesceConsole(line, { ...line, level: 'warn' })).toBeUndefined();
  });
});
