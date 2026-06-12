import { has, isEqual, isObject } from 'lodash-es';

import { EValueDescriptorErrorCode } from '../codes';
import type { ValueDescriptorFail } from '../types';

import { ValueDescriptorError } from './error';
import { Fail } from './fail';
import type { AnyFail } from './types';
import { FAIL_TAG } from './types';

export function isFail<F extends AnyFail>(v: unknown): v is F {
  return isObject(v) && has(v, 'tag') && v.tag === FAIL_TAG;
}

export function isEqualsFails<A extends AnyFail, B extends AnyFail>(a: A, b: B) {
  return a.tag === b.tag && a.code === b.code && isEqual(a.meta, b.meta);
}

export function convertErrorToFail(error: Error | ValueDescriptorError): ValueDescriptorFail {
  return error instanceof ValueDescriptorError
    ? Fail(error.code, {
        message: error.message,
        description: error.description,
      })
    : Fail(EValueDescriptorErrorCode.UNKNOWN, {
        message: error.message,
      });
}

export function convertFailToError(fail: ValueDescriptorFail): ValueDescriptorError {
  return new ValueDescriptorError(fail.meta.message, fail.code, fail.meta.description);
}
