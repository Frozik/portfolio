import type { Vector2 } from '@frozik/utils/math/vector2';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { Foundation, UtilityEntryId, UtilitySystem } from '../domain/model/foundation';
import type { Building } from '../domain/model/site-plan';
import type { CutFillReport } from '../domain/terrain/cut-fill';
import type { Meters } from '../domain/units';
import type { DuctRun } from './duct-scenes';
import type { PitchedRoofScene } from './roof-scenes';
import type { StoreyScene } from './storey-scenes';

/** One utility entry resolved onto the plan — where its system enters the house. */
export interface PlanUtilityEntry {
  readonly id: UtilityEntryId;
  readonly system: UtilitySystem;
  readonly position: Vector2;
}

/** One building resolved against the terrain — see `buildingScenes`. */
export interface BuildingScene {
  readonly building: Building;
  readonly polygons: MultiPolygon;
  readonly padElevation: Meters | undefined;
  readonly cutFill: CutFillReport | undefined;
  readonly foundation: Foundation;
  /** Concrete estimate for the panel; piers are not estimated (no count yet). */
  readonly foundationVolumeCubicMeters: number | undefined;
  /** Entries the footprint can actually place — nothing without an outline. */
  readonly entryPoints: readonly PlanUtilityEntry[];
  /** The storeys resolved bottom-up; index = level. */
  readonly storeys: readonly StoreyScene[];
  /** The pitched roof over the top storey, or nothing while the top is flat. */
  readonly pitchedRoof: PitchedRoofScene | undefined;
  /** Every flue and vent shaft of the building over its whole run. */
  readonly ducts: readonly DuctRun[];
}
