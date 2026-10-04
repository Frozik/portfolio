/* oxlint-disable no-console -- the hub under test mirrors the console */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_TIME } from '../testing/report-fixture';
import { DEFAULT_DIAGNOSTICS_LIMITS, DiagnosticsHub } from './diagnostics';

describe('DiagnosticsHub', () => {
  let hub: DiagnosticsHub | undefined;

  afterEach(() => {
    hub?.dispose();
    vi.restoreAllMocks();
  });

  it('counts what it has collected so far, in every section', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hub = new DiagnosticsHub({
      now: () => FIXTURE_TIME,
      limits: DEFAULT_DIAGNOSTICS_LIMITS,
      ignoreWithin: () => false,
    });

    console.error('Transfer rejected', {});
    window.dispatchEvent(new ErrorEvent('error', { message: 'Test error' }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(hub.counts()).toEqual({
      console: 1,
      errors: 1,
      breadcrumbs: 1,
      network: 0,
      performance: 0,
    });
    const snapshot = await hub.snapshot();
    expect(snapshot.console[0]?.message).toBe('Transfer rejected {}');
    expect(snapshot.errors[0]?.message).toBe('Test error');
  });
});
