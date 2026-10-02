import { describe, expect, it } from 'vitest';

import { ChartDataError, isAbsent, isTransient, toDataError } from './data-error';

describe('data errors', () => {
  it('keeps the code of an error the source raised itself', () => {
    const raised = new ChartDataError('NOT_FOUND', 'no such scale');

    expect(toDataError(raised)).toBe(raised);
  });

  it('calls anything without a code unknown', () => {
    expect(toDataError(new Error('boom')).code).toBe('UNKNOWN');
    expect(toDataError('plain text').message).toBe('plain text');
  });

  it('reads an aborted request as cancelled, not as a failure', () => {
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';

    expect(toDataError(aborted).code).toBe('CANCELLED');
  });

  it('retries only what the server may answer next time', () => {
    expect(isTransient('UNAVAILABLE')).toBe(true);
    expect(isTransient('DEADLINE_EXCEEDED')).toBe(true);
    expect(isTransient('NOT_FOUND')).toBe(false);
    expect(isTransient('INTERNAL')).toBe(false);
  });

  it('tells data that does not exist from data that failed to arrive', () => {
    expect(isAbsent('NOT_FOUND')).toBe(true);
    expect(isAbsent('UNIMPLEMENTED')).toBe(true);
    expect(isAbsent('UNAVAILABLE')).toBe(false);
  });
});
