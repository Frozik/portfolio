import type { Vector2 } from '@frozik/utils/math/vector2';

import type { VerticalDuct } from './ducts';
import type { ElectricalDevice } from './electrical';
import type { Fireplace } from './fireplaces';
import type { FurnitureInstance } from './furniture';
import type { Slab } from './slabs';
import type { StairInstance } from './stairs';
import type { Storey } from './storeys';
import {
  devicesOf,
  ductsOf,
  fireplacesOf,
  furnitureOf,
  slabsOf,
  stairsOf,
  supportsOf,
} from './storeys';
import type { SupportPost } from './supports';

/**
 * The things that STAND ON A STOREY (`building-editor.md` §5): furniture, a
 * stair, a post, a floor slab, a fireplace, a shaft, an electrical device.
 * They differ in what they mean and in how they are drawn, and in nothing else:
 * each is a list on the storey, addressed by id, added, changed and removed the
 * same way.
 *
 * This registry is that sameness, stated once. Before it, a new kind of object
 * had to be written by hand into the storey model, four CRUD edits, the
 * snapshot guard, four store commands, a drag gesture, the selection union, the
 * plan reader and its own panel — ten places, of which the compiler caught
 * three. A kind now contributes ONE descriptor, and everything generic over the
 * family — the edits below, the store's commands, delete and duplicate — reads
 * it instead of switching.
 */
export type StoreyObjectKey =
  | 'furniture'
  | 'stair'
  | 'support'
  | 'slab'
  | 'fireplace'
  | 'duct'
  | 'device';

/** Anything a storey holds a list of: identified, and somewhere on the plan. */
export interface StoreyObject {
  readonly id: string;
}

/**
 * How one kind is read off a storey and written back onto it. The two halves
 * are all a generic edit needs, and stating them together is what makes it
 * impossible to read one field and write another.
 */
export interface StoreyObjectKind<TInstance extends StoreyObject> {
  readonly key: StoreyObjectKey;
  readonly read: (storey: Storey) => readonly TInstance[];
  readonly write: (storey: Storey, items: readonly TInstance[]) => Storey;
}

function defineKind<TInstance extends StoreyObject>(
  kind: StoreyObjectKind<TInstance>
): StoreyObjectKind<TInstance> {
  return kind;
}

export const FURNITURE_OBJECTS = defineKind<FurnitureInstance>({
  key: 'furniture',
  read: furnitureOf,
  write: (storey, furniture) => ({ ...storey, furniture }),
});

export const STAIR_OBJECTS = defineKind<StairInstance>({
  key: 'stair',
  read: stairsOf,
  write: (storey, stairs) => ({ ...storey, stairs }),
});

export const SUPPORT_OBJECTS = defineKind<SupportPost>({
  key: 'support',
  read: supportsOf,
  write: (storey, supports) => ({ ...storey, supports }),
});

export const SLAB_OBJECTS = defineKind<Slab>({
  key: 'slab',
  read: slabsOf,
  write: (storey, slabs) => ({ ...storey, slabs }),
});

export const FIREPLACE_OBJECTS = defineKind<Fireplace>({
  key: 'fireplace',
  read: fireplacesOf,
  write: (storey, fireplaces) => ({ ...storey, fireplaces }),
});

export const DUCT_OBJECTS = defineKind<VerticalDuct>({
  key: 'duct',
  read: ductsOf,
  write: (storey, ducts) => ({ ...storey, ducts }),
});

export const DEVICE_OBJECTS = defineKind<ElectricalDevice>({
  key: 'device',
  read: devicesOf,
  write: (storey, devices) => ({ ...storey, devices }),
});

/**
 * Whatever carries a position on the plan — which is every kind but a slab,
 * whose position is its shape's centre, and a device, which hangs on a host.
 * Used by the gestures and the copy, both of which speak in offsets.
 */
export interface PlacedStoreyObject extends StoreyObject {
  readonly position: Vector2;
}
