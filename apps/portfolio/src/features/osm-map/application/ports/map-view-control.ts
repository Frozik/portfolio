import type { MapView } from '../../domain/map-view';
import type { LonLat } from '../../domain/mercator';

/** What the running map lets the store do to the camera. */
export interface MapViewControl {
  setView(view: MapView): void;
  /** Turns the map so north is up again, keeping the target, zoom and pitch. */
  resetNorth(): void;
  /** Centres the map over a place, keeping zoom, bearing and pitch. */
  moveTo(position: LonLat): void;
}
