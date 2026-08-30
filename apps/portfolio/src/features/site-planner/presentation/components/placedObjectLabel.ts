import { assertNever } from '@frozik/utils/assert/assertNever';

import type { PlacedObject } from '../../domain/model/placed-object';
import { sitePlannerT } from '../translations';

/** What an object is called wherever the editor names one: the tool button, its flyout, the panels. */
export function describePlacedObject(object: PlacedObject): string {
  switch (object.kind) {
    case 'tree':
      return sitePlannerT.properties.species[object.species];
    case 'car':
      return sitePlannerT.properties.car;
    default:
      return assertNever(object);
  }
}
