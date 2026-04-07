import { EValueDescriptorErrorCode } from '../codes';
import type { ValueDescriptorFail } from '../types';

import { ValueDescriptorError } from './error';
import { Fail } from './fail';
import { FAIL_TAG } from './types';
import {
  convertErrorToFail,
  convertFailToError,
  findWorstFailIndex,
  isEqualsFails,
  isFail,
} from './utils';

describe('isFail', () => {
  it('returns true for a Fail object', () => {
    const fail = Fail('TEST_CODE');
    expect(isFail(fail)).toBe(true);
  });

  it('returns true for a Fail with meta', () => {
    const fail = Fail('TEST_CODE', { message: 'err' });
    expect(isFail(fail)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isFail(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFail(undefined)).toBe(false);
  });

  it('returns false for a plain object without tag', () => {
    expect(isFail({ code: 'X' })).toBe(false);
  });

  it('returns false for an object with wrong tag', () => {
    expect(isFail({ tag: 'NOT_FAIL', code: 'X' })).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isFail('fail')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isFail(42)).toBe(false);
  });
});

describe('isEqualsFails', () => {
  it('returns true for identical fails', () => {
    const a = Fail('CODE', { message: 'msg' });
    const b = Fail('CODE', { message: 'msg' });
    expect(isEqualsFails(a, b)).toBe(true);
  });

  it('returns false for different codes', () => {
    const a = Fail('CODE_A');
    const b = Fail('CODE_B');
    expect(isEqualsFails(a, b)).toBe(false);
  });

  it('returns false for different meta', () => {
    const a = Fail('CODE', { message: 'a' });
    const b = Fail('CODE', { message: 'b' });
    expect(isEqualsFails(a, b)).toBe(false);
  });

  it('returns true for fails with no meta', () => {
    const a = Fail('CODE');
    const b = Fail('CODE');
    expect(isEqualsFails(a, b)).toBe(true);
  });
});

describe('convertErrorToFail', () => {
  it('converts regular Error to UNKNOWN fail', () => {
    const error = new Error('something broke');
    const fail = convertErrorToFail(error);

    expect(fail.tag).toBe(FAIL_TAG);
    expect(fail.code).toBe(EValueDescriptorErrorCode.UNKNOWN);
    expect(fail.meta).toEqual({ message: 'something broke' });
  });

  it('converts ValueDescriptorError to typed fail', () => {
    const error = new ValueDescriptorError(
      'not found',
      EValueDescriptorErrorCode.NOT_FOUND,
      'resource xyz'
    );
    const fail = convertErrorToFail(error);

    expect(fail.code).toBe(EValueDescriptorErrorCode.NOT_FOUND);
    expect(fail.meta).toEqual({ message: 'not found', description: 'resource xyz' });
  });
});

describe('convertFailToError', () => {
  it('converts fail back to ValueDescriptorError', () => {
    const fail: ValueDescriptorFail = Fail(EValueDescriptorErrorCode.INTERNAL, {
      message: 'oops',
      description: 'details',
    });
    const error = convertFailToError(fail);

    expect(error).toBeInstanceOf(ValueDescriptorError);
    expect(error.message).toBe('oops');
    expect(error.code).toBe(EValueDescriptorErrorCode.INTERNAL);
    expect(error.description).toBe('details');
  });

  it('roundtrips Error -> Fail -> Error', () => {
    const original = new ValueDescriptorError(
      'test msg',
      EValueDescriptorErrorCode.CANCELLED,
      'test desc'
    );
    const fail = convertErrorToFail(original);
    const restored = convertFailToError(fail);

    expect(restored.message).toBe(original.message);
    expect(restored.code).toBe(original.code);
    expect(restored.description).toBe(original.description);
  });
});

describe('findWorstFailIndex', () => {
  it('returns index of highest-priority fail', () => {
    const fails: ValueDescriptorFail[] = [
      Fail(EValueDescriptorErrorCode.CANCELLED, { message: 'a' }),
      Fail(EValueDescriptorErrorCode.UNAUTHENTICATED, { message: 'b' }),
      Fail(EValueDescriptorErrorCode.NOT_FOUND, { message: 'c' }),
    ];

    expect(findWorstFailIndex(fails)).toBe(1);
  });

  it('returns 0 for a single-element array', () => {
    const fails: ValueDescriptorFail[] = [
      Fail(EValueDescriptorErrorCode.UNKNOWN, { message: 'only' }),
    ];

    expect(findWorstFailIndex(fails)).toBe(0);
  });

  it('returns first index when all fails are equal priority', () => {
    const fails: ValueDescriptorFail[] = [
      Fail(EValueDescriptorErrorCode.UNKNOWN, { message: 'a' }),
      Fail(EValueDescriptorErrorCode.UNKNOWN, { message: 'b' }),
    ];

    expect(findWorstFailIndex(fails)).toBe(0);
  });
});
