import type { BoardViewport } from './board-viewport';
import type { Station } from './station';
import { STATION_HALF_SPAN_METERS } from './station';
import { stationLightOf } from './station-light';

/**
 * The uniform block every board shader is bound to. The first twelve
 * floats are `BoardUniforms` as all of them declare it; the eight after
 * are the station's, which only `shaders/station.wgsl` declares and reads.
 */
const BOARD_FLOATS = 12;
const STATION_FLOATS = 8;
export const BOARD_UNIFORM_BYTES = (BOARD_FLOATS + STATION_FLOATS) * Float32Array.BYTES_PER_ELEMENT;
/** The pattern is shifted per level by this many metres per seed step, folded so the shift stays small. */
const PATTERN_SHIFT_METERS_PER_SEED = 1.37;
const PATTERN_SHIFT_PERIOD_SEEDS = 97;

export function boardUniformsOf(frame: {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly viewport: BoardViewport;
  readonly seed: number;
  readonly timeSeconds: number;
  readonly station: Station | undefined;
}): Float32Array {
  const { viewport, station } = frame;
  const values = new Float32Array(BOARD_FLOATS + STATION_FLOATS);
  values.set([
    frame.canvasWidth,
    frame.canvasHeight,
    viewport.origin.x,
    viewport.origin.y,
    viewport.xAxis.x,
    viewport.xAxis.y,
    viewport.yAxis.x,
    viewport.yAxis.y,
    viewport.scale,
    (frame.seed % PATTERN_SHIFT_PERIOD_SEEDS) * PATTERN_SHIFT_METERS_PER_SEED,
    frame.timeSeconds,
  ]);
  if (station === undefined) {
    return values;
  }
  const light = stationLightOf(station);
  values.set(
    [
      station.position.x,
      station.position.y,
      station.attitude.x,
      station.attitude.y,
      light.shadowCentre.x,
      light.shadowCentre.y,
      STATION_HALF_SPAN_METERS,
      light.shadowRadius,
    ],
    BOARD_FLOATS
  );
  return values;
}
