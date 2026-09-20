import type { MockInstance } from 'vitest';

import { reportError } from './reportError';

describe('reportError', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('puts the cause in the console next to what was being done', () => {
    const cause = new Error('quota exceeded');

    reportError('persisting the generation 7', cause);

    expect(consoleError).toHaveBeenCalledWith('persisting the generation 7:', cause);
  });

  it('reports a thrown value that is not an error', () => {
    reportError('loading the catalog', 'offline');

    expect(consoleError).toHaveBeenCalledWith('loading the catalog:', 'offline');
  });
});
