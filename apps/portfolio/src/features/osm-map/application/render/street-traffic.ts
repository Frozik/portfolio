import alea from 'alea';

import { enterCars, seedCars } from '../../domain/car-fleet';
import type { Car, CarPose } from '../../domain/car-traffic';
import { advanceCars, carPoses } from '../../domain/car-traffic';
import { MAX_TRAFFIC_STEP_SECONDS } from '../../domain/constants';
import type { RoadLine } from '../../domain/road-lines';
import type { StreetGraph } from '../../domain/street-graph';
import { buildStreetGraph } from '../../domain/street-graph';
import type { TileKey } from '../../domain/tile-key';

/** Junction choices are random but repeatable within a session. */
const TRAFFIC_SEED = 'osm-map-traffic';

/**
 * The moving cars of every street tile in the picture, stepped once per
 * frame. The roads of the standing tiles form one graph, so a car drives
 * through junctions and across tile borders alike; it is gone only when it
 * drives off the edge of the loaded roads, and a new one comes in there.
 */
export class StreetTraffic {
  private readonly roadsByTile = new Map<TileKey, readonly RoadLine[]>();
  private graph: StreetGraph = buildStreetGraph([]);
  private cars: readonly Car[] = [];
  private lastStepTime: number | undefined;
  private readonly random = alea(TRAFFIC_SEED);

  constructor(private readonly roadsOf: (key: TileKey) => readonly RoadLine[]) {}

  /** Seeds the tiles that arrived, forgets the ones that left, moves everyone on by the time since the last step. */
  step(standing: readonly TileKey[], nowSeconds: number): void {
    const dtSeconds = Math.min(
      MAX_TRAFFIC_STEP_SECONDS,
      Math.max(0, nowSeconds - (this.lastStepTime ?? nowSeconds))
    );
    this.lastStepTime = nowSeconds;
    if (this.updateTiles(standing)) {
      this.graph = buildStreetGraph(this.roadsByTile.values());
    }
    const { cars, departed } = advanceCars(this.graph, this.cars, dtSeconds, this.random);
    this.cars = departed === 0 ? cars : [...cars, ...enterCars(this.graph, departed, this.random)];
  }

  /** Nothing moves: the next step starts the clock afresh instead of jumping. */
  pause(): void {
    this.roadsByTile.clear();
    this.graph = buildStreetGraph([]);
    this.cars = [];
    this.lastStepTime = undefined;
  }

  get moving(): boolean {
    return this.cars.length > 0;
  }

  get carCount(): number {
    return this.cars.length;
  }

  poses(): readonly CarPose[] {
    return carPoses(this.graph, this.cars);
  }

  private updateTiles(standing: readonly TileKey[]): boolean {
    const standingKeys = new Set(standing);
    let changed = false;
    for (const key of this.roadsByTile.keys()) {
      if (!standingKeys.has(key)) {
        this.roadsByTile.delete(key);
        this.cars = this.cars.filter(car => !car.lineKey.startsWith(`${key}/`));
        changed = true;
      }
    }
    for (const key of standingKeys) {
      if (!this.roadsByTile.has(key)) {
        const roads = this.roadsOf(key);
        this.roadsByTile.set(key, roads);
        this.cars = [...this.cars, ...seedCars(roads, key)];
        changed = true;
      }
    }
    return changed;
  }
}
