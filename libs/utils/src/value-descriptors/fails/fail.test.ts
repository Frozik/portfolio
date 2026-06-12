import { Fail } from './fail';
import { FAIL_TAG } from './types';

describe('Fail', () => {
  it('creates a fail with tag and code', () => {
    const fail = Fail('NOT_FOUND');

    expect(fail).toEqual({
      tag: FAIL_TAG,
      code: 'NOT_FOUND',
      meta: undefined,
    });
  });

  it('creates a fail with tag, code, and meta', () => {
    const fail = Fail('UNKNOWN', { message: 'something went wrong' });

    expect(fail).toEqual({
      tag: FAIL_TAG,
      code: 'UNKNOWN',
      meta: { message: 'something went wrong' },
    });
  });
});
