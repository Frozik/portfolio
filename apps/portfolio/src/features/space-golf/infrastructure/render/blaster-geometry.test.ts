import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import { writeBlaster } from './blaster-geometry';
import { MESH_COLOR_OFFSET_BYTES, MESH_VERTEX_STRIDE_BYTES, MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';
import type { DrawnBand } from './scene-frame';

const ANCHOR: Vector2 = { x: 3, y: 5 };
const CHANNELS = 4;
/** The reticle and the dim core reach this far round the press; the blaster reaches much further. */
const RETICLE_REACH_METERS = 0.36;
/** The ring of the chamber the gauge is set in, just inside its gold edges. */
const GAUGE_BAND_METERS = [0.38, 0.51] as const;
const LIT_ALPHA = 150;

interface DrawnVertex {
  readonly point: Vector2;
  readonly color: readonly number[];
}

/** The finger below the anchor: the energy is drawn downwards, so the shot goes up. */
function bandDrawn(stretchMeters: number, meterOnBoard = 1): DrawnBand {
  return {
    anchor: ANCHOR,
    pull: { x: ANCHOR.x, y: ANCHOR.y - stretchMeters * meterOnBoard },
    meterOnBoard,
  };
}

function drawn(band: DrawnBand, timeSeconds = 0, armed = true): readonly DrawnVertex[] {
  const writer = new MeshWriter();
  writeBlaster(writer, band, { armed, timeSeconds });
  const { vertexData, vertexCount } = writer.finish();
  const view = new DataView(vertexData);
  const vertices: DrawnVertex[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const offset = index * MESH_VERTEX_STRIDE_BYTES;
    vertices.push({
      point: { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) },
      color: Array.from({ length: CHANNELS }, (_, channel) =>
        view.getUint8(offset + MESH_COLOR_OFFSET_BYTES + channel)
      ),
    });
  }
  return vertices;
}

function spread(band: DrawnBand): number {
  return Math.max(...drawn(band).map(vertex => distance(vertex.point, band.anchor)));
}

function count(vertices: readonly DrawnVertex[], color: readonly number[]): number {
  return vertices.filter(vertex => vertex.color.every((channel, index) => channel === color[index]))
    .length;
}

/** How many vertices carry the full white-hot energy: the lit rings, the channel and gauge at their hottest. */
function whiteHot(band: DrawnBand, armed = true): number {
  return count(drawn(band, 0, armed), PALETTE.bandCore);
}

/** How many vertices of the gauge in the chamber are lit: bright, where the dark ones are faint. */
function litGauge(band: DrawnBand): number {
  const [inner, outer] = GAUGE_BAND_METERS;
  return drawn(band).filter(vertex => {
    const away = distance(vertex.point, ANCHOR);
    return away > inner && away < outer && vertex.color[3] > LIT_ALPHA;
  }).length;
}

describe('the blaster being charged', () => {
  it('marks the centre from the very first touch, and stands the blaster round it only once the pull earns a stroke', () => {
    const pressed: DrawnBand = { anchor: ANCHOR, pull: ANCHOR, meterOnBoard: 1 };

    expect(drawn(pressed).length).toBeGreaterThan(0);
    expect(spread(pressed)).toBeLessThan(RETICLE_REACH_METERS);
    expect(spread(bandDrawn(AIM_DEAD_ZONE_METERS * 0.9))).toBeLessThan(RETICLE_REACH_METERS);
    expect(spread(bandDrawn(AIM_DEAD_ZONE_METERS * 1.01))).toBeGreaterThan(0.9);
  });

  it('points the nose where the ball will fly and draws the energy from the finger behind', () => {
    const band = bandDrawn(0.9);
    const points = drawn(band).map(vertex => vertex.point);

    expect(Math.max(...points.map(point => point.y - ANCHOR.y))).toBeGreaterThan(0.9);
    expect(Math.min(...points.map(point => distance(point, band.pull)))).toBeLessThan(0.05);
  });

  it('draws the energy from no further than the strongest stroke: pulling on only turns the blaster', () => {
    const behindCore = (band: DrawnBand): number =>
      Math.max(...drawn(band).map(vertex => ANCHOR.y - vertex.point.y));

    const full = behindCore(bandDrawn(MAX_PULL_METERS));
    expect(behindCore(bandDrawn(MAX_PULL_METERS * 0.6))).toBeLessThan(full);
    expect(behindCore(bandDrawn(MAX_PULL_METERS * 3))).toBeCloseTo(full);
  });

  it('fills the gauge the harder it is pulled, and no further past the strongest stroke', () => {
    const gentle = litGauge(bandDrawn(0.3));
    const hard = litGauge(bandDrawn(0.9));
    const full = litGauge(bandDrawn(MAX_PULL_METERS));

    expect(litGauge(bandDrawn(AIM_DEAD_ZONE_METERS * 1.01))).toBe(0);
    expect(gentle).toBeLessThan(hard);
    expect(hard).toBeLessThan(full);
    expect(litGauge(bandDrawn(MAX_PULL_METERS * 2))).toBe(full);
  });

  it('lights the focusing rings one by one ahead of the nose, the last one exactly at the strongest stroke', () => {
    const third = AIM_DEAD_ZONE_METERS + (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS) / 3;

    expect(whiteHot(bandDrawn(third * 0.95))).toBe(0);
    expect(whiteHot(bandDrawn(third * 1.05))).toBeGreaterThan(0);
    expect(whiteHot(bandDrawn(MAX_PULL_METERS * 0.95))).toBeLessThan(
      whiteHot(bandDrawn(MAX_PULL_METERS))
    );
    expect(whiteHot(bandDrawn(MAX_PULL_METERS * 2))).toBe(whiteHot(bandDrawn(MAX_PULL_METERS)));
  });

  it('swells the core as it charges', () => {
    const coreReach = (band: DrawnBand): number =>
      Math.max(
        ...drawn(band)
          .filter(vertex => vertex.color[3] === 255 && distance(vertex.point, ANCHOR) < 0.2)
          .map(vertex => distance(vertex.point, ANCHOR))
      );

    expect(coreReach(bandDrawn(0.2))).toBeLessThan(coreReach(bandDrawn(MAX_PULL_METERS)));
  });

  it('charges with the ball still moving but stays cold: a grey gauge and dark rings until it rests', () => {
    const band = bandDrawn(MAX_PULL_METERS);

    expect(count(drawn(band, 0, false), PALETTE.dotPending)).toBeGreaterThan(0);
    expect(count(drawn(band, 0, true), PALETTE.dotPending)).toBe(0);
    expect(whiteHot(band, false)).toBeLessThan(whiteHot(band, true));
  });

  it('keeps its size on the screen: a view zoomed out draws the very same blaster larger on the board', () => {
    expect(spread(bandDrawn(0.6, 2))).toBeCloseTo(spread(bandDrawn(0.6)) * 2);
  });

  it('never stands still: the core beats and the motes flow in', () => {
    const band = bandDrawn(0.6);

    expect(drawn(band, 0)).not.toEqual(drawn(band, 0.2));
  });
});
