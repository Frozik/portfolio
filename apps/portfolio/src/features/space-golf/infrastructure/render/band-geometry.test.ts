import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import { writeBand } from './band-geometry';
import { MESH_COLOR_OFFSET_BYTES, MESH_VERTEX_STRIDE_BYTES, MeshWriter } from './mesh-writer';
import type { DrawnBand } from './scene-frame';

const ANCHOR: Vector2 = { x: 3, y: 5 };
const ALPHA_CHANNEL = 3;

interface DrawnVertex {
  readonly point: Vector2;
  readonly alpha: number;
}

function bandPulled(stretchMeters: number, meterOnBoard = 1): DrawnBand {
  return {
    anchor: ANCHOR,
    pull: { x: ANCHOR.x + stretchMeters * meterOnBoard, y: ANCHOR.y },
    meterOnBoard,
  };
}

function drawn(band: DrawnBand, timeSeconds = 0): readonly DrawnVertex[] {
  const writer = new MeshWriter();
  writeBand(writer, band, timeSeconds);
  const { vertexData, vertexCount } = writer.finish();
  const view = new DataView(vertexData);
  const vertices: DrawnVertex[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const offset = index * MESH_VERTEX_STRIDE_BYTES;
    vertices.push({
      point: { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) },
      alpha: view.getUint8(offset + MESH_COLOR_OFFSET_BYTES + ALPHA_CHANNEL),
    });
  }
  return vertices;
}

function strongestAlpha(band: DrawnBand, timeSeconds = 0): number {
  return Math.max(...drawn(band, timeSeconds).map(vertex => vertex.alpha));
}

function widthAround(band: DrawnBand, point: Vector2): number {
  return Math.max(...drawn(band).map(vertex => distance(vertex.point, point)));
}

describe('the band being pulled', () => {
  it('stands where the pull began, with nothing drawn away from it while the band is slack', () => {
    const slack: DrawnBand = { anchor: ANCHOR, pull: ANCHOR, meterOnBoard: 1 };

    const spread = widthAround(slack, ANCHOR);
    expect(spread).toBeGreaterThan(0.2);
    expect(spread).toBeLessThan(0.5);
  });

  it('grows more opaque the further the band is pulled, and no further past the strongest stroke', () => {
    const gentle = strongestAlpha(bandPulled(0.3));
    const hard = strongestAlpha(bandPulled(0.9));
    const full = strongestAlpha(bandPulled(MAX_PULL_METERS));

    expect(strongestAlpha(bandPulled(0))).toBeLessThan(gentle);
    expect(gentle).toBeLessThan(hard);
    expect(hard).toBeLessThan(full);
    expect(strongestAlpha(bandPulled(MAX_PULL_METERS * 2))).toBe(full);
  });

  it('reaches the finger: the lines of energy end where the pointer is now', () => {
    const band = bandPulled(MAX_PULL_METERS);

    const nearest = Math.min(...drawn(band).map(vertex => distance(vertex.point, band.pull)));
    expect(nearest).toBeLessThan(0.05);
  });

  it('keeps its size on the screen: a view zoomed out draws the very same picture larger on the board', () => {
    const close = bandPulled(0.6);
    const zoomedOut = bandPulled(0.6, 2);

    expect(widthAround(zoomedOut, zoomedOut.anchor)).toBeCloseTo(
      widthAround(close, close.anchor) * 2
    );
  });

  it('never stands still: the haze quivers and the energy runs along the lines', () => {
    const band = bandPulled(0.6);

    expect(drawn(band, 0)).not.toEqual(drawn(band, 0.2));
  });
});
