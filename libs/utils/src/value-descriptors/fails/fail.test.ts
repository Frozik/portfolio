import { Fail, FailFactory } from './fail';
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

describe('FailFactory', () => {
  it('creates scoped fails with prefix', () => {
    const createFail = FailFactory('TestScope');
    const fail = createFail('TIMEOUT');

    expect(fail).toEqual({
      tag: FAIL_TAG,
      code: '[TestScope]: TIMEOUT',
      meta: undefined,
    });
  });

  it('creates scoped fails with prefix and meta', () => {
    const createFail = FailFactory('ScopeMeta');
    const fail = createFail('ERR', { detail: 42 });

    expect(fail).toEqual({
      tag: FAIL_TAG,
      code: '[ScopeMeta]: ERR',
      meta: { detail: 42 },
    });
  });

  it('throws on duplicate prefix', () => {
    FailFactory('UniquePrefix');

    expect(() => FailFactory('UniquePrefix')).toThrow('Prefix UniquePrefix already used');
  });
});
