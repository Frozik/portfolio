import { isNil } from 'lodash-es';

import type { Building } from './building';
import { entriesOf } from './building';
import type { BuildingWarning } from './building-warnings';
import type { Selection } from './selection';
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

/**
 * The layers of the building editor — the разделы of a house project: what
 * carries it, what divides it, what furnishes it, what wires it, what runs
 * through it. Exactly one is ACTIVE (drawn, picked, its tools on the rail);
 * the rest are context or hidden. See `layers.md`.
 *
 * A layer is never stored on an object: what an object IS says which layer it
 * belongs to, so the tables below are the whole membership — one column per
 * registry, checked by the compiler, no snapshot field, no migration.
 */
export type BuildingLayerId = 'structure' | 'walls' | 'furniture' | 'electrical' | 'services';

/** In rail and menu order: from what carries the house to what fills it. */
export const BUILDING_LAYER_IDS: readonly BuildingLayerId[] = [
  'structure',
  'walls',
  'furniture',
  'electrical',
  'services',
];

/** A building opens on its walls: the first job in an empty house. */
export const DEFAULT_BUILDING_LAYER: BuildingLayerId = 'walls';

/** The layer after (or before) this one, wrapping — the Q key of the editor. */
export function cycleBuildingLayer(layer: BuildingLayerId, direction: 1 | -1): BuildingLayerId {
  const count = BUILDING_LAYER_IDS.length;
  const index = BUILDING_LAYER_IDS.indexOf(layer);

  return BUILDING_LAYER_IDS[(index + direction + count) % count];
}

/**
 * Which layer each kind of selection lives on; the kinds outside a building
 * have none. A full record rather than a lookup of the building kinds alone,
 * so a new kind of object stops compiling until it is placed on a layer.
 */
const SELECTION_LAYERS: Readonly<Record<Selection['kind'], BuildingLayerId | undefined>> = {
  slab: 'structure',
  support: 'structure',
  wall: 'walls',
  opening: 'walls',
  stair: 'walls',
  furniture: 'furniture',
  device: 'electrical',
  fireplace: 'services',
  duct: 'services',
  utilityEntry: 'services',
  shape: undefined,
  group: undefined,
  mark: undefined,
  tree: undefined,
  car: undefined,
  path: undefined,
  building: undefined,
  utilityRoute: undefined,
};

export function layerOfSelection(selection: Selection): BuildingLayerId | undefined {
  return SELECTION_LAYERS[selection.kind];
}

/** Whether a selection can be made while this layer is the active one. */
export function isSelectionOnLayer(selection: Selection, layer: BuildingLayerId): boolean {
  const own = layerOfSelection(selection);

  return isNil(own) || own === layer;
}

/**
 * The layer a finding is about — where the fix is made, which is where
 * «reveal» takes the editor. A low storey and a flat roof are structure; a
 * room with nothing to breathe through wants a shaft, so it is services.
 */
const WARNING_LAYERS: Readonly<Record<BuildingWarning['kind'], BuildingLayerId>> = {
  'furniture-over-stairwell': 'furniture',
  'wall-over-stairwell': 'walls',
  'stair-uncomfortable': 'walls',
  'cantilever-unsupported': 'structure',
  'storey-too-low': 'structure',
  'roof-too-flat': 'structure',
  'room-without-exhaust': 'services',
  'sauna-without-stove': 'services',
  'duct-outside-roof': 'services',
};

export function layerOfWarning(warning: BuildingWarning): BuildingLayerId {
  return WARNING_LAYERS[warning.kind];
}

/**
 * How many objects each layer holds on one storey — what the layer menu
 * prints beside a name, so an empty layer reads as empty before it is opened.
 * Utility entries belong to the building, not the storey, and count on every
 * storey: they are the seam every storey's services meet at.
 */
export function countLayerObjects(
  building: Building,
  storey: Storey
): Readonly<Record<BuildingLayerId, number>> {
  return {
    structure: slabsOf(storey).length + supportsOf(storey).length,
    walls: storey.walls.length + storey.openings.length + stairsOf(storey).length,
    furniture: furnitureOf(storey).length,
    electrical: devicesOf(storey).length,
    services: fireplacesOf(storey).length + ductsOf(storey).length + entriesOf(building).length,
  };
}
