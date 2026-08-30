import type { FurnitureCatalogId } from '../model/furniture';
import type { WorldPoint } from '../view/world-frame';

/**
 * One placed piece as the 3D view draws it: which template stands there, at
 * what world point (the storey's floor plus the piece's own elevation baked
 * into `y`), turned the way the plan turned it — the car's instancing pattern,
 * template by catalogue row instead of one template for every car.
 */
export interface SceneFurniture {
  readonly catalogId: FurnitureCatalogId;
  readonly position: WorldPoint;
  readonly rotationDegrees: number;
}
