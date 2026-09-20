import type { MockInstance } from 'vitest';

import { EValueDescriptorErrorCode } from './codes';
import { failedValueDescriptor } from './failedValueDescriptor';
import { isFailValueDescriptor } from './utils';

describe('failedValueDescriptor', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('describes the failure so a panel can render it', () => {
    const descriptor = failedValueDescriptor('loading the robot', new Error('not found'));

    expect(isFailValueDescriptor(descriptor)).toBe(true);
    expect(descriptor.fail?.meta.message).toBe('not found');
    expect(descriptor.fail?.code).toBe(EValueDescriptorErrorCode.UNKNOWN);
  });

  it('reports the cause, which the descriptor alone would lose', () => {
    const cause = new Error('quota exceeded');

    failedValueDescriptor('persisting the generation 7', cause);

    expect(consoleError).toHaveBeenCalledWith('persisting the generation 7:', cause);
  });
});
