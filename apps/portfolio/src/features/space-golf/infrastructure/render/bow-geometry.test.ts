import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import { writeBow } from './bow-geometry';
import { MESH_COLOR_OFFSET_BYTES, MESH_VERTEX_STRIDE_BYTES, MeshWriter } from './mesh-writer';
import type { DrawnBand } from './scene-frame';

const ANCHOR: Vector2 = { x: 3, y: 5 };
const ALPHA_CHANNEL = 3;
/** How far the sparks turning about the nock reach past it. */
const SPARK_REACH_METERS = 0.3;

interface DrawnVertex {
  readonly point: Vector2;
  readonly alpha: number;
}

/** The finger below the anchor: the string is drawn downwards, so the shot goes up. */
function bandDrawn(stretchMeters: number, meterOnBoard = 1): DrawnBand {
  return {
    anchor: ANCHOR,
    pull: { x: ANCHOR.x, y: ANCHOR.y - stretchMeters * meterOnBoard },
    meterOnBoard,
  };
}

function drawn(band: DrawnBand, timeSeconds = 0, nocked = true): readonly DrawnVertex[] {
  const writer = new MeshWriter();
  writeBow(writer, band, { nocked, timeSeconds });
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

function strongestAlpha(band: DrawnBand): number {
  return Math.max(...drawn(band).map(vertex => vertex.alpha));
}

function spread(band: DrawnBand, from: Vector2): number {
  return Math.max(...drawn(band).map(vertex => distance(vertex.point, from)));
}

describe('the bow being drawn', () => {
  it('shows no bow while the band is too slack to play a stroke: only the haze marks the press', () => {
    const pressed: DrawnBand = { anchor: ANCHOR, pull: ANCHOR, meterOnBoard: 1 };
    const slack = bandDrawn(AIM_DEAD_ZONE_METERS * 0.9);

    expect(spread(pressed, ANCHOR)).toBeLessThan(0.3);
    expect(spread(slack, ANCHOR)).toBeLessThan(0.3);
    // The bow comes with the stroke: the very pull that earns one brings it out.
    expect(spread(bandDrawn(AIM_DEAD_ZONE_METERS * 1.01), ANCHOR)).toBeGreaterThan(0.9);
  });

  it('draws the string no further than the strongest stroke: pulling on only turns the bow', () => {
    // How far behind the anchor the drawing reaches — the nock of the string.
    const behindAnchor = (band: DrawnBand): number =>
      Math.max(...drawn(band).map(vertex => ANCHOR.y - vertex.point.y));

    const full = behindAnchor(bandDrawn(MAX_PULL_METERS));
    expect(behindAnchor(bandDrawn(MAX_PULL_METERS * 0.8))).toBeLessThan(full);
    expect(behindAnchor(bandDrawn(MAX_PULL_METERS * 2))).toBeCloseTo(full);
    expect(behindAnchor(bandDrawn(MAX_PULL_METERS * 10))).toBeCloseTo(full);

    // The bow still turns with the finger, though the string stays where it is;
    // the sparks orbit the nock, so the farthest vertex wanders by their reach.
    const sideways: DrawnBand = {
      anchor: ANCHOR,
      pull: { x: ANCHOR.x - MAX_PULL_METERS * 2, y: ANCHOR.y },
      meterOnBoard: 1,
    };
    const turned = Math.max(...drawn(sideways).map(vertex => ANCHOR.x - vertex.point.x));
    expect(Math.abs(turned - full)).toBeLessThan(SPARK_REACH_METERS);
  });

  it('stands its limbs across the shot and reaches a limb to either side of the anchor', () => {
    const points = drawn(bandDrawn(0.6)).map(vertex => vertex.point);

    // The shot goes up, so the limbs run left and right of the anchor and the tips lie a metre out.
    expect(Math.max(...points.map(point => point.x - ANCHOR.x))).toBeGreaterThan(0.9);
    expect(Math.min(...points.map(point => point.x - ANCHOR.x))).toBeLessThan(-0.9);
  });

  it('points the arrow where the ball will fly: ahead of the anchor, never behind the finger', () => {
    const band = bandDrawn(0.9);

    const points = drawn(band).map(vertex => vertex.point);
    const ahead = Math.max(...points.map(point => point.y - ANCHOR.y));
    const behind = Math.min(...points.map(point => point.y - band.pull.y));
    expect(ahead).toBeGreaterThan(0.4);
    expect(behind).toBeGreaterThan(-0.3);
  });

  it('draws the string back to the finger, deeper the further the band is pulled', () => {
    const gentle = bandDrawn(0.3);
    const hard = bandDrawn(MAX_PULL_METERS);

    const nearestTo = (band: DrawnBand): number =>
      Math.min(...drawn(band).map(vertex => distance(vertex.point, band.pull)));
    expect(nearestTo(gentle)).toBeLessThan(0.05);
    expect(nearestTo(hard)).toBeLessThan(0.05);
    expect(spread(hard, ANCHOR)).toBeGreaterThan(spread(gentle, ANCHOR));
  });

  it('grows brighter the further the string is drawn, and no brighter past the strongest stroke', () => {
    const gentle = strongestAlpha(bandDrawn(0.3));
    const hard = strongestAlpha(bandDrawn(0.9));
    const full = strongestAlpha(bandDrawn(MAX_PULL_METERS));

    expect(strongestAlpha(bandDrawn(0.05))).toBeLessThan(gentle);
    expect(gentle).toBeLessThan(hard);
    expect(hard).toBeLessThanOrEqual(full);
    expect(strongestAlpha(bandDrawn(MAX_PULL_METERS * 2))).toBe(full);
  });

  it('nocks no arrow while the ball still moves: the bow is drawn on nothing until it rests', () => {
    const band = bandDrawn(0.9);
    const aheadOfAnchor = (nocked: boolean): number =>
      Math.max(...drawn(band, 0, nocked).map(vertex => vertex.point.y - ANCHOR.y));

    // Only the arrow reaches out in front of the bow; the limbs and the string stay behind it.
    expect(aheadOfAnchor(true)).toBeGreaterThan(0.7);
    expect(aheadOfAnchor(false)).toBeLessThan(0.5);
    // The bow itself is still drawn, and still drawn to the finger.
    expect(
      Math.min(...drawn(band, 0, false).map(vertex => distance(vertex.point, band.pull)))
    ).toBeLessThan(0.05);
    expect(spread(band, ANCHOR)).toBeGreaterThan(0.9);
  });

  it('keeps its size on the screen: a view zoomed out draws the very same bow larger on the board', () => {
    const close = bandDrawn(0.6);
    const zoomedOut = bandDrawn(0.6, 2);

    expect(spread(zoomedOut, zoomedOut.anchor)).toBeCloseTo(spread(close, close.anchor) * 2);
  });

  it('never stands still: the string hums and the sparks ride the arrow', () => {
    const band = bandDrawn(0.6);

    expect(drawn(band, 0)).not.toEqual(drawn(band, 0.2));
  });
});
