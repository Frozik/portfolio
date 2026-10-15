import { isOperationError } from './operation-error';

describe('a failed WebCrypto check', () => {
  it('is recognised when it comes from another realm, where it is no Error of this one', () => {
    const foreign: unknown = Object.assign(Object.create(null) as object, {
      name: 'OperationError',
      message: 'The operation failed for an operation-specific reason',
    });

    expect(isOperationError(foreign)).toBe(true);
  });

  it('is not any other failure', () => {
    expect([isOperationError(new TypeError('bad key')), isOperationError(null)]).toEqual([
      false,
      false,
    ]);
  });
});
