import type { EValueDescriptorErrorCode } from './codes';
import type { FailStruct } from './fails/types';

export type ValueDescriptor<SyncPayload, UnsyncPayload = never> =
  | SyncedValueDescriptor<SyncPayload>
  | UnsyncedValueDescriptor<UnsyncPayload>;

export enum EValueDescriptorState {
  Synced = 'Synced',
  Unsynced = 'Unsynced',
}

// biome-ignore lint/suspicious/noExplicitAny: wildcard type alias requires any
export type AnyValueDescriptor = ValueDescriptor<any, any>;

export type SyncedValueDescriptor<P> = {
  state: EValueDescriptorState.Synced;
  value: P;
  fail: null;
  meta: null;
};
export type UnsyncedValueDescriptor<P = never> = {
  state: EValueDescriptorState.Unsynced;
  value: null | P;
  fail: null | ValueDescriptorFail;
  meta: null | MetaState;
};

export enum EValueDescriptorPendingState {
  WaitingArguments = 'WaitingArguments',
  Requesting = 'Requesting',
  Receiving = 'Receiving',
}

export type MetaState = {
  pendingState: null | EValueDescriptorPendingState;
};

export type ExtractValueDescriptorPayload<T> =
  T extends ValueDescriptor<infer A, infer B> ? A | B : never;

export type ExtractSyncedValueDescriptorPayload<T> =
  T extends SyncedValueDescriptor<infer A> ? A : never;

export type ExtractUnsyncedValueDescriptorPayload<T> =
  T extends UnsyncedValueDescriptor<infer A> ? A : never;

export type ExtractSyncedValueDescriptor<T extends AnyValueDescriptor> = Extract<
  T,
  { state: EValueDescriptorState.Synced }
>;

export type ExtractUnsyncedValueDescriptor<T extends AnyValueDescriptor> = Extract<
  T,
  { state: EValueDescriptorState.Unsynced }
>;

type ExtractSyncPayload<T1, T2> =
  | (T1 extends SyncedValueDescriptor<infer P1> ? P1 : never)
  | (T2 extends SyncedValueDescriptor<infer P2> ? P2 : never);

type ExtractUnsyncPayload<T1, T2> =
  | (T1 extends UnsyncedValueDescriptor<infer P1> ? P1 : never)
  | (T2 extends UnsyncedValueDescriptor<infer P2> ? P2 : never);

export type TryConvertToValueDescriptor<T1, T2> = T1 extends AnyValueDescriptor
  ? T2 extends AnyValueDescriptor
    ? ValueDescriptor<ExtractSyncPayload<T1, T2>, ExtractUnsyncPayload<T1, T2>>
    : T1 | T2
  : T1 | T2;

export type ValueDescriptorHandlers<
  VD extends AnyValueDescriptor,
  Out1 = ExtractSyncedValueDescriptor<VD>,
  Out2 = ExtractUnsyncedValueDescriptor<VD>,
> = {
  synced: (desc: ExtractSyncedValueDescriptor<VD>) => Out1;
  unsynced: (desc: ExtractUnsyncedValueDescriptor<VD>) => Out2;
};

export type ValueDescriptorHandler<
  VD extends AnyValueDescriptor,
  Out = ExtractSyncedValueDescriptor<VD>,
> = (desc: ExtractSyncedValueDescriptor<VD>) => Out;

type TFailMeta = {
  message: string;
  description?: string;
};

export type ValueDescriptorFail =
  | FailStruct<EValueDescriptorErrorCode.CANCELLED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.UNKNOWN, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.INVALID_ARGUMENT, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.DEADLINE_EXCEEDED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.NOT_FOUND, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.ALREADY_EXISTS, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.PERMISSION_DENIED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.RESOURCE_EXHAUSTED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.FAILED_PRECONDITION, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.ABORTED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.OUT_OF_RANGE, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.UNIMPLEMENTED, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.INTERNAL, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.UNAVAILABLE, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.DATA_LOSS, TFailMeta>
  | FailStruct<EValueDescriptorErrorCode.UNAUTHENTICATED, TFailMeta>;
