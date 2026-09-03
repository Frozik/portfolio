import { describe, expect, it } from 'vitest';

import { createDuct } from './ducts';
import { createCeilingLight } from './electrical';
import { createFireplace } from './fireplaces';
import type { FurnitureCatalogId } from './furniture';
import { createFurniture } from './furniture';
import { createRectangle } from './shapes';
import { createStair } from './stairs';
import type { StoreyObject, StoreyObjectKey, StoreyObjectKind } from './storey-objects';
import {
  DEVICE_OBJECTS,
  DUCT_OBJECTS,
  FIREPLACE_OBJECTS,
  FURNITURE_OBJECTS,
  SLAB_OBJECTS,
  STAIR_OBJECTS,
  SUPPORT_OBJECTS,
} from './storey-objects';
import type { Storey } from './storeys';
import { createStorey } from './storeys';
import { createSupport } from './supports';

const AT = { x: 1, y: 2 };

function emptyStorey(): Storey {
  return createStorey({ heightMeters: 2.7 });
}

/**
 * One kind with a sample of its own instance, closed over its concrete type.
 * The laws below hold for every kind, and a probe is what lets them be stated
 * once for a family whose members are of different types.
 */
interface KindProbe {
  readonly key: StoreyObjectKey;
  readonly write: (storey: Storey) => Storey;
  readonly read: (storey: Storey) => readonly StoreyObject[];
  readonly item: StoreyObject;
}

function probe<TInstance extends StoreyObject>(
  kind: StoreyObjectKind<TInstance>,
  item: TInstance
): KindProbe {
  return { key: kind.key, write: storey => kind.write(storey, [item]), read: kind.read, item };
}

const PROBES: readonly KindProbe[] = [
  probe(
    FURNITURE_OBJECTS,
    createFurniture({ catalogId: 'sofa' as FurnitureCatalogId, position: AT })
  ),
  probe(STAIR_OBJECTS, createStair({ kind: 'straight', position: AT })),
  probe(SUPPORT_OBJECTS, createSupport({ position: AT })),
  probe(SLAB_OBJECTS, createRectangle({ center: AT, width: 2, length: 3, rotationDegrees: 0 })),
  probe(FIREPLACE_OBJECTS, createFireplace({ kind: 'stove', position: AT })),
  probe(DUCT_OBJECTS, createDuct({ kind: 'vent', position: AT })),
  probe(DEVICE_OBJECTS, createCeilingLight(AT)),
];

describe('the storey-object registry', () => {
  it('describes every kind exactly once', () => {
    const keys = PROBES.map(kind => kind.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PROBES)('reads back whatever it writes ($key)', kind => {
    expect(kind.read(kind.write(emptyStorey()))).toEqual([kind.item]);
  });

  it.each(PROBES)('reads an empty list off a bare storey ($key)', kind => {
    expect(kind.read(emptyStorey())).toEqual([]);
  });

  it.each(PROBES)('writes into its own field and no other ($key)', kind => {
    const storey = kind.write(emptyStorey());

    for (const other of PROBES) {
      if (other.key !== kind.key) {
        expect(other.read(storey)).toEqual([]);
      }
    }
  });
});
