import { assertNever } from '@frozik/utils/assert/assertNever';

import { DEFAULT_TREE_SPECIES } from '../constants';
import type { TreeSpecies } from './site-plan';
import { TREE_SPECIES } from './site-plan';

/**
 * What the placing tool puts on the plan next. Editor state rather than part of
 * the document: the plan records the tree or the car that was placed, never the
 * choice that was standing when it happened.
 */
export type PlacedObject =
  | { readonly kind: 'tree'; readonly species: TreeSpecies }
  | { readonly kind: 'car' };

export const CAR_PLACED_OBJECT: PlacedObject = { kind: 'car' };

/** Every object the catalogue offers, in the order it lays them out. */
export const PLACED_OBJECT_CATALOG: readonly PlacedObject[] = [
  ...TREE_SPECIES.map((species): PlacedObject => ({ kind: 'tree', species })),
  CAR_PLACED_OBJECT,
];

export const DEFAULT_PLACED_OBJECT: PlacedObject = {
  kind: 'tree',
  species: DEFAULT_TREE_SPECIES,
};

/**
 * One string per catalogue entry. It names an entry for a React key and — since
 * two entries are equal exactly when their keys are — for the comparison that
 * marks the chosen tile.
 */
export function placedObjectKey(object: PlacedObject): string {
  switch (object.kind) {
    case 'tree':
      return `tree:${object.species}`;
    case 'car':
      return 'car';
    default:
      return assertNever(object);
  }
}
