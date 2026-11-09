import type { Brand } from '@frozik/utils/types/base';
import type { Temporal } from 'temporal-polyfill';

import type { IPolicy, ITemporaryPolicy } from '../../policy/domain/policy';
import type { TMember } from './member';

export type TGroupId = Brand<string, 'GroupId'>;

/** A palette slot, not a colour: each theme maps it to a pair that keeps its contrast. */
export type TColorSlot =
  | 'blue'
  | 'teal'
  | 'green'
  | 'amber'
  | 'orange'
  | 'red'
  | 'pink'
  | 'violet'
  | 'slate';

export const COLOR_SLOTS = [
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'red',
  'pink',
  'violet',
  'slate',
] as const satisfies readonly TColorSlot[];

/** «#ff8800»: a colour the user picked or typed, shown as it is in both themes. */
export type THexColor = Brand<string, 'HexColor'>;

export type TGroupColor = TColorSlot | THexColor;

export interface IAutoReply {
  readonly text: string;
}

interface IGroupCore {
  readonly id: TGroupId;
  readonly color: TGroupColor;
  readonly policy: IPolicy;
  readonly temporary: ITemporaryPolicy | null;
  readonly autoReply: IAutoReply | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

/** A group the user made: who is in it, who is taken out, and whether the address book is. */
export interface ICustomGroup extends IGroupCore {
  readonly kind: 'custom';
  readonly name: string;
  readonly include: readonly TMember[];
  readonly exclude: readonly TMember[];
  readonly excludeMyContacts: boolean;
}

/** The whole address book, less what is excluded: its inclusion is fixed. */
export interface IMyContactsGroup extends IGroupCore {
  readonly kind: 'my-contacts';
  readonly exclude: readonly TMember[];
}

/** Whatever no other group took, by number or by name: nobody can be put here by hand. */
export interface IStrangersGroup extends IGroupCore {
  readonly kind: 'strangers';
}

export type TGroup = ICustomGroup | IMyContactsGroup | IStrangersGroup;

/** Groups that can be named as the place for a caller: the strangers are only where callers fall. */
export type TAssignableGroup = ICustomGroup | IMyContactsGroup;
