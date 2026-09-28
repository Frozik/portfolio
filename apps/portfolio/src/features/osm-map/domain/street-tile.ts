import type { BuildingMesh } from './building-footprint';
import type { RoadLine } from './road-lines';
import type { TreeBatch } from './tree-cover';
import type { WaterMesh } from './water-surface';

/** What a z14 vector tile contributes to the street view: the buildings as one mesh, the roads cars drive, the water that ripples and the trees. */
export interface StreetTile {
  readonly buildings: BuildingMesh;
  readonly roads: readonly RoadLine[];
  readonly water: WaterMesh;
  readonly trees: readonly TreeBatch[];
}
