import { describe, expect, it } from 'vitest';

import { BOARD_UNIFORM_BYTES, boardUniformsOf } from './board-uniforms';
import { viewportOf } from './board-viewport';
import type { Station } from './station';
import { STATION_HALF_SPAN_METERS } from './station';
import { stationLightOf } from './station-light';

const CANVAS = { width: 800, height: 600 };
const STATION_AT = 12;
const STATION: Station = {
  position: { x: 3, y: 47 },
  attitude: { x: 0, y: -1 },
  ageSeconds: 5,
  dayShare: 0.3,
  shadowWay: { x: 1, y: 0 },
};

function uniformsWith(station: Station | undefined): Float32Array {
  return boardUniformsOf({
    canvasWidth: CANVAS.width,
    canvasHeight: CANVAS.height,
    viewport: viewportOf({ x: 0, y: 47 }, 64, CANVAS),
    seed: 5,
    timeSeconds: 2,
    station,
  });
}

describe('what the board shaders are told', () => {
  it('fills the whole block the shaders are bound to, the station abroad or not', () => {
    expect(uniformsWith(undefined).byteLength).toBe(BOARD_UNIFORM_BYTES);
    expect(uniformsWith(STATION).byteLength).toBe(BOARD_UNIFORM_BYTES);
  });

  it('tells the board its canvas, its view and its time, the same whether a station is abroad or not', () => {
    const [without, withStation] = [uniformsWith(undefined), uniformsWith(STATION)];

    expect([...without.slice(0, 2)]).toEqual([CANVAS.width, CANVAS.height]);
    expect(without[8]).toBe(64);
    expect(without[10]).toBe(2);
    expect([...withStation.slice(0, STATION_AT)]).toEqual([...without.slice(0, STATION_AT)]);
  });

  it('tells the station shader where the station lies, how it is turned and where the shadow falls on it', () => {
    const light = stationLightOf(STATION);

    const told = [...uniformsWith(STATION).slice(STATION_AT)];

    expect(told.slice(0, 4)).toEqual([3, 47, 0, -1]);
    expect(told[4]).toBeCloseTo(light.shadowCentre.x, 5);
    expect(told[5]).toBeCloseTo(light.shadowCentre.y, 5);
    expect(told[6]).toBeCloseTo(STATION_HALF_SPAN_METERS, 5);
    expect(told[7]).toBeCloseTo(light.shadowRadius, 5);
  });
});
