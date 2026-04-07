import { EValueDescriptorErrorCode } from './codes';
import { Fail } from './fails';
import type { ValueDescriptor, ValueDescriptorFail } from './types';
import { EValueDescriptorPendingState, EValueDescriptorState } from './types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isEmptyValueDescriptor,
  isEqualValueDescriptor,
  isFailValueDescriptor,
  isLoadingValueDescriptor,
  isReceivingValueDescriptor,
  isRequestingValueDescriptor,
  isSyncedValueDescriptor,
  isSyncOrEmptyValueDescriptor,
  isUnsyncedValueDescriptor,
  isValueDescriptor,
  isWaitingArgumentsValueDescriptor,
  matchValueDescriptor,
  mergeMetaValueDescriptor,
  RECEIVING_VD,
  REQUESTING_VD,
  upsertMetaValueDescriptor,
  WAITING_VD,
} from './utils';

const UNKNOWN_FAIL: ValueDescriptorFail = Fail(EValueDescriptorErrorCode.UNKNOWN, {
  message: 'test error',
});

describe('createSyncedValueDescriptor', () => {
  it('returns correct structure with a primitive value', () => {
    const vd = createSyncedValueDescriptor(42);

    expect(vd).toEqual({
      state: EValueDescriptorState.Synced,
      value: 42,
      fail: null,
      meta: null,
    });
  });

  it('returns correct structure with an object value', () => {
    const payload = { name: 'test' };
    const vd = createSyncedValueDescriptor(payload);

    expect(vd.state).toBe(EValueDescriptorState.Synced);
    expect(vd.value).toBe(payload);
    expect(vd.fail).toBeNull();
    expect(vd.meta).toBeNull();
  });
});

describe('createUnsyncedValueDescriptor', () => {
  it('creates unsynced VD with fail only', () => {
    const vd = createUnsyncedValueDescriptor(UNKNOWN_FAIL);

    expect(vd).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: UNKNOWN_FAIL,
      meta: null,
    });
  });

  it('creates unsynced VD with fail and meta', () => {
    const meta = { pendingState: EValueDescriptorPendingState.Requesting };
    const vd = createUnsyncedValueDescriptor(UNKNOWN_FAIL, meta);

    expect(vd).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: UNKNOWN_FAIL,
      meta,
    });
  });

  it('creates unsynced VD with value, fail, and meta', () => {
    const meta = { pendingState: EValueDescriptorPendingState.Receiving };
    const vd = createUnsyncedValueDescriptor('partial', UNKNOWN_FAIL, meta);

    expect(vd).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: 'partial',
      fail: UNKNOWN_FAIL,
      meta,
    });
  });

  it('creates unsynced VD with null fail (empty)', () => {
    const vd = createUnsyncedValueDescriptor(null);

    expect(vd).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: null,
      meta: null,
    });
  });
});

describe('matchValueDescriptor', () => {
  it('calls synced handler for synced VD', () => {
    const synced = createSyncedValueDescriptor(10);
    const result = matchValueDescriptor(synced, {
      synced: vd => vd.value * 2,
      unsynced: () => -1,
    });

    expect(result).toBe(20);
  });

  it('calls unsynced handler for unsynced VD', () => {
    const unsynced = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    const result = matchValueDescriptor(unsynced, {
      synced: () => 'ok',
      unsynced: () => 'fail',
    });

    expect(result).toBe('fail');
  });

  it('function form returns unsynced as-is for unsynced VD', () => {
    const unsynced = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    const vd = unsynced as ValueDescriptor<number>;
    const result = matchValueDescriptor(vd, syncedVd => syncedVd.value + 1);

    expect(result).toBe(unsynced);
  });

  it('function form calls handler for synced VD', () => {
    const synced = createSyncedValueDescriptor(5);
    const vd = synced as ValueDescriptor<number>;
    const result = matchValueDescriptor(vd, syncedVd => syncedVd.value + 1);

    expect(result).toBe(6);
  });
});

describe('isSyncedValueDescriptor', () => {
  it('returns true for synced VD', () => {
    expect(isSyncedValueDescriptor(createSyncedValueDescriptor(1))).toBe(true);
  });

  it('returns false for unsynced VD', () => {
    expect(isSyncedValueDescriptor(EMPTY_VD)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSyncedValueDescriptor(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSyncedValueDescriptor(undefined)).toBe(false);
  });
});

describe('isUnsyncedValueDescriptor', () => {
  it('returns true for unsynced VD', () => {
    expect(isUnsyncedValueDescriptor(EMPTY_VD)).toBe(true);
  });

  it('returns false for synced VD', () => {
    expect(isUnsyncedValueDescriptor(createSyncedValueDescriptor(1))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isUnsyncedValueDescriptor(null)).toBe(false);
  });
});

describe('isFailValueDescriptor', () => {
  it('returns true when unsynced VD has a fail', () => {
    const vd = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    expect(isFailValueDescriptor(vd)).toBe(true);
  });

  it('returns false for empty unsynced VD', () => {
    expect(isFailValueDescriptor(EMPTY_VD)).toBe(false);
  });

  it('returns false for synced VD', () => {
    expect(isFailValueDescriptor(createSyncedValueDescriptor(1))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFailValueDescriptor(null)).toBe(false);
  });
});

describe('isEmptyValueDescriptor', () => {
  it('returns true for EMPTY_VD', () => {
    expect(isEmptyValueDescriptor(EMPTY_VD)).toBe(true);
  });

  it('returns false for WAITING_VD (has meta)', () => {
    expect(isEmptyValueDescriptor(WAITING_VD)).toBe(false);
  });

  it('returns false for synced VD', () => {
    expect(isEmptyValueDescriptor(createSyncedValueDescriptor(1))).toBe(false);
  });

  it('returns false for fail VD', () => {
    expect(isEmptyValueDescriptor(createUnsyncedValueDescriptor(UNKNOWN_FAIL))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEmptyValueDescriptor(null)).toBe(false);
  });
});

describe('pending state checks', () => {
  describe('isWaitingArgumentsValueDescriptor', () => {
    it('returns true for WAITING_VD', () => {
      expect(isWaitingArgumentsValueDescriptor(WAITING_VD)).toBe(true);
    });

    it('returns false for REQUESTING_VD', () => {
      expect(isWaitingArgumentsValueDescriptor(REQUESTING_VD)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isWaitingArgumentsValueDescriptor(null)).toBe(false);
    });
  });

  describe('isRequestingValueDescriptor', () => {
    it('returns true for REQUESTING_VD', () => {
      expect(isRequestingValueDescriptor(REQUESTING_VD)).toBe(true);
    });

    it('returns false for WAITING_VD', () => {
      expect(isRequestingValueDescriptor(WAITING_VD)).toBe(false);
    });
  });

  describe('isReceivingValueDescriptor', () => {
    it('returns true for RECEIVING_VD', () => {
      expect(isReceivingValueDescriptor(RECEIVING_VD)).toBe(true);
    });

    it('returns false for REQUESTING_VD', () => {
      expect(isReceivingValueDescriptor(REQUESTING_VD)).toBe(false);
    });
  });

  describe('isLoadingValueDescriptor', () => {
    it('returns true for REQUESTING_VD', () => {
      expect(isLoadingValueDescriptor(REQUESTING_VD)).toBe(true);
    });

    it('returns true for RECEIVING_VD', () => {
      expect(isLoadingValueDescriptor(RECEIVING_VD)).toBe(true);
    });

    it('returns false for WAITING_VD', () => {
      expect(isLoadingValueDescriptor(WAITING_VD)).toBe(false);
    });

    it('returns false for EMPTY_VD', () => {
      expect(isLoadingValueDescriptor(EMPTY_VD)).toBe(false);
    });
  });
});

describe('isSyncOrEmptyValueDescriptor', () => {
  it('returns true for synced VD', () => {
    expect(isSyncOrEmptyValueDescriptor(createSyncedValueDescriptor(1))).toBe(true);
  });

  it('returns true for EMPTY_VD', () => {
    expect(isSyncOrEmptyValueDescriptor(EMPTY_VD)).toBe(true);
  });

  it('returns false for WAITING_VD', () => {
    expect(isSyncOrEmptyValueDescriptor(WAITING_VD)).toBe(false);
  });

  it('returns false for fail VD', () => {
    expect(isSyncOrEmptyValueDescriptor(createUnsyncedValueDescriptor(UNKNOWN_FAIL))).toBe(false);
  });
});

describe('isEqualValueDescriptor', () => {
  it('returns true for identical synced VDs', () => {
    const a = createSyncedValueDescriptor(42);
    const b = createSyncedValueDescriptor(42);
    expect(isEqualValueDescriptor(a, b)).toBe(true);
  });

  it('returns false for different states', () => {
    const a = createSyncedValueDescriptor(42);
    const b = EMPTY_VD;
    expect(isEqualValueDescriptor(a, b)).toBe(false);
  });

  it('returns false for different values', () => {
    const a = createSyncedValueDescriptor(1);
    const b = createSyncedValueDescriptor(2);
    expect(isEqualValueDescriptor(a, b)).toBe(false);
  });

  it('returns true for identical fail VDs', () => {
    const a = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    const b = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    expect(isEqualValueDescriptor(a, b)).toBe(true);
  });

  it('uses custom equality function', () => {
    const a = createSyncedValueDescriptor({ id: 1, extra: 'a' });
    const b = createSyncedValueDescriptor({ id: 1, extra: 'b' });

    const byId = (x: { id: number }, y: { id: number }) => x.id === y.id;
    expect(isEqualValueDescriptor(a, b, byId)).toBe(true);
  });

  it('returns false when one has fail and other does not', () => {
    const a = createUnsyncedValueDescriptor(UNKNOWN_FAIL);
    const b = EMPTY_VD;
    expect(isEqualValueDescriptor(a, b)).toBe(false);
  });
});

describe('EMPTY_VD', () => {
  it('has correct structure', () => {
    expect(EMPTY_VD).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: null,
      meta: null,
    });
  });
});

describe('WAITING_VD', () => {
  it('has correct structure', () => {
    expect(WAITING_VD).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: null,
      meta: { pendingState: EValueDescriptorPendingState.WaitingArguments },
    });
  });
});

describe('REQUESTING_VD', () => {
  it('has correct structure', () => {
    expect(REQUESTING_VD).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: null,
      meta: { pendingState: EValueDescriptorPendingState.Requesting },
    });
  });
});

describe('RECEIVING_VD', () => {
  it('has correct structure', () => {
    expect(RECEIVING_VD).toEqual({
      state: EValueDescriptorState.Unsynced,
      value: null,
      fail: null,
      meta: { pendingState: EValueDescriptorPendingState.Receiving },
    });
  });
});

describe('mergeMetaValueDescriptor', () => {
  it('merges two meta states preferring first', () => {
    const a = { pendingState: EValueDescriptorPendingState.Requesting };
    const b = { pendingState: EValueDescriptorPendingState.Receiving };
    expect(mergeMetaValueDescriptor(a, b)).toEqual({
      pendingState: EValueDescriptorPendingState.Requesting,
    });
  });

  it('falls back to second when first is null', () => {
    const b = { pendingState: EValueDescriptorPendingState.Receiving };
    expect(mergeMetaValueDescriptor(null, b)).toEqual({
      pendingState: EValueDescriptorPendingState.Receiving,
    });
  });

  it('returns null pendingState when both are null', () => {
    expect(mergeMetaValueDescriptor(null, null)).toEqual({ pendingState: null });
  });
});

describe('upsertMetaValueDescriptor', () => {
  it('updates meta on a synced VD', () => {
    const vd = createSyncedValueDescriptor(10);
    const result = upsertMetaValueDescriptor(vd, {
      pendingState: EValueDescriptorPendingState.Requesting,
    });

    expect(result.meta).toEqual({ pendingState: EValueDescriptorPendingState.Requesting });
    expect(result.value).toBe(10);
  });

  it('merges meta on an unsynced VD preserving existing', () => {
    const vd = createUnsyncedValueDescriptor(UNKNOWN_FAIL, {
      pendingState: EValueDescriptorPendingState.Receiving,
    });
    const result = upsertMetaValueDescriptor(vd, {});

    expect(result.meta).toEqual({ pendingState: EValueDescriptorPendingState.Receiving });
  });
});

describe('isValueDescriptor', () => {
  it('returns true for synced VD', () => {
    expect(isValueDescriptor(createSyncedValueDescriptor(1))).toBe(true);
  });

  it('returns true for unsynced VD', () => {
    expect(isValueDescriptor(EMPTY_VD)).toBe(true);
  });

  it('returns false for plain object', () => {
    expect(isValueDescriptor({ foo: 'bar' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValueDescriptor(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isValueDescriptor('hello')).toBe(false);
  });

  it('returns false for a Fail object', () => {
    expect(isValueDescriptor(UNKNOWN_FAIL)).toBe(false);
  });
});
