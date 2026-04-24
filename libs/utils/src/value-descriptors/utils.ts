import { isEqual, isFunction, isNil, isObject } from 'lodash-es';
import type { Nil } from '../types/base';

import { isEqualsFails, isFail } from './fails/utils';
import type {
  AnyValueDescriptor,
  ExtractSyncedValueDescriptor,
  ExtractUnsyncedValueDescriptor,
  ExtractValueDescriptorPayload,
  MetaState,
  SyncedValueDescriptor,
  TryConvertToValueDescriptor,
  UnsyncedValueDescriptor,
  ValueDescriptorFail,
  ValueDescriptorHandler,
  ValueDescriptorHandlers,
} from './types';
import { EValueDescriptorPendingState, EValueDescriptorState } from './types';

export function createSyncedValueDescriptor<P>(value: P): SyncedValueDescriptor<P> {
  return {
    state: EValueDescriptorState.Synced,
    value,
    fail: null,
    meta: null,
  };
}

export function createUnsyncedValueDescriptor(
  fail: null | ValueDescriptorFail,
  meta?: null | MetaState
): UnsyncedValueDescriptor;
export function createUnsyncedValueDescriptor<P>(
  value: P,
  fail: null | ValueDescriptorFail,
  meta?: null | MetaState
): UnsyncedValueDescriptor<P>;
export function createUnsyncedValueDescriptor<P = never>(
  valueOrFail: ValueDescriptorFail | P,
  failOrMeta?: null | ValueDescriptorFail | MetaState,
  meta?: null | MetaState
): UnsyncedValueDescriptor<P> {
  let value: P | undefined;
  let fail: ValueDescriptorFail | undefined;

  if (!isFail(valueOrFail)) {
    value = valueOrFail;
  } else {
    fail = valueOrFail;
  }

  if (isFail(failOrMeta)) {
    fail = failOrMeta;
  } else {
    meta = failOrMeta;
  }

  return {
    state: EValueDescriptorState.Unsynced,
    value: value ?? null,
    fail: fail ?? null,
    meta: meta ?? null,
  };
}

export function mergeMetaValueDescriptor(
  a: Nil | Partial<MetaState>,
  b: Nil | Partial<MetaState>
): MetaState {
  return {
    pendingState: a?.pendingState ?? b?.pendingState ?? null,
  };
}

export function upsertMetaValueDescriptor<T extends AnyValueDescriptor>(
  vd: T,
  meta: Partial<MetaState>
): T {
  return {
    state: vd.state,
    fail: vd.fail,
    value: vd.value,
    meta: mergeMetaValueDescriptor(meta, vd.meta),
  } as T;
}

export const EMPTY_VD: UnsyncedValueDescriptor = {
  state: EValueDescriptorState.Unsynced,
  value: null,
  fail: null,
  meta: null,
};

export const WAITING_VD: UnsyncedValueDescriptor = {
  state: EValueDescriptorState.Unsynced,
  value: null,
  fail: null,
  meta: {
    pendingState: EValueDescriptorPendingState.WaitingArguments,
  },
};

export const REQUESTING_VD: UnsyncedValueDescriptor = {
  state: EValueDescriptorState.Unsynced,
  value: null,
  fail: null,
  meta: {
    pendingState: EValueDescriptorPendingState.Requesting,
  },
};

export const RECEIVING_VD: UnsyncedValueDescriptor = {
  state: EValueDescriptorState.Unsynced,
  value: null,
  fail: null,
  meta: {
    pendingState: EValueDescriptorPendingState.Receiving,
  },
};

export function matchValueDescriptor<VD extends AnyValueDescriptor, Out1, Out2>(
  descriptor: VD,
  handlers: ValueDescriptorHandler<VD, Out1> | ValueDescriptorHandlers<VD, Out1, Out2>
): TryConvertToValueDescriptor<Out1, Out2> {
  const synced = isFunction(handlers) ? handlers : handlers.synced;
  const unsynced = isFunction(handlers)
    ? (vd: ExtractUnsyncedValueDescriptor<VD>): Out2 => vd as Out2
    : handlers.unsynced;

  switch (descriptor.state) {
    case EValueDescriptorState.Synced:
      return synced(descriptor as ExtractSyncedValueDescriptor<VD>) as TryConvertToValueDescriptor<
        Out1,
        Out2
      >;
    case EValueDescriptorState.Unsynced:
      return unsynced(
        descriptor as ExtractUnsyncedValueDescriptor<VD>
      ) as TryConvertToValueDescriptor<Out1, Out2>;
  }
}

export function isValueDescriptor<T extends AnyValueDescriptor>(
  value: unknown | T
): value is Extract<T, AnyValueDescriptor> {
  return isObject(value) && 'state' in value && 'fail' in value && 'value' in value;
}

export function isSyncedValueDescriptor<VD extends AnyValueDescriptor>(
  value: Nil | VD
): value is ExtractSyncedValueDescriptor<VD> {
  return !isNil(value) && value.state === EValueDescriptorState.Synced;
}

export function isUnsyncedValueDescriptor<VD extends AnyValueDescriptor>(
  value: Nil | VD
): value is ExtractUnsyncedValueDescriptor<VD> {
  return !isNil(value) && value.state === EValueDescriptorState.Unsynced;
}

export function isEqualValueDescriptor<A extends AnyValueDescriptor, B extends AnyValueDescriptor>(
  a: A,
  b: B,
  isEqualPayload: (
    a: ExtractValueDescriptorPayload<A>,
    b: ExtractValueDescriptorPayload<B>
  ) => boolean = isEqual
) {
  if (a.state !== b.state) {
    return false;
  }
  if (isNil(a.fail) !== isNil(b.fail)) {
    return false;
  }
  if (isNil(a.value) !== isNil(b.value)) {
    return false;
  }
  if (!isNil(a.fail) && !isNil(b.fail) && !isEqualsFails(a.fail, b.fail)) {
    return false;
  }
  return !(!isNil(a.value) && !isNil(b.value) && !isEqualPayload(a.value, b.value));
}

export function isEmptyValueDescriptor(vd: Nil | AnyValueDescriptor): boolean {
  return isUnsyncedValueDescriptor(vd) && isNil(vd.fail) && isNil(vd.meta);
}

export function isWaitingArgumentsValueDescriptor(vd: Nil | AnyValueDescriptor): boolean {
  return vd?.meta?.pendingState === EValueDescriptorPendingState.WaitingArguments;
}

export function isRequestingValueDescriptor(vd: Nil | AnyValueDescriptor): boolean {
  return vd?.meta?.pendingState === EValueDescriptorPendingState.Requesting;
}

export function isReceivingValueDescriptor(vd: Nil | AnyValueDescriptor): boolean {
  return vd?.meta?.pendingState === EValueDescriptorPendingState.Receiving;
}

export function isLoadingValueDescriptor(vd: Nil | AnyValueDescriptor): boolean {
  return isRequestingValueDescriptor(vd) || isReceivingValueDescriptor(vd);
}

export function isSyncOrEmptyValueDescriptor<VD extends AnyValueDescriptor>(
  value: Nil | VD
): boolean {
  return isSyncedValueDescriptor(value) || isEmptyValueDescriptor(value);
}

export function isFailValueDescriptor<T extends AnyValueDescriptor>(
  vd: Nil | T
): vd is T & { fail: ValueDescriptorFail } {
  return isUnsyncedValueDescriptor(vd) && !isNil(vd.fail);
}
