import type { BuildingMesh } from './building-footprint';
import type { RoadLine } from './road-lines';

/** What a z14 vector tile contributes to the street view: the buildings as one mesh and the roads cars drive. */
export interface StreetTile {
  readonly buildings: BuildingMesh;
  readonly roads: readonly RoadLine[];
}
