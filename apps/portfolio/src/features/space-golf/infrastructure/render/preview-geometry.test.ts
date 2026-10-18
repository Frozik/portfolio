import { describe, expect, it } from 'vitest';

import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { MESH_COLOR_OFFSET_BYTES, MeshWriter } from './mesh-writer';
import { writePreviewDots } from './preview-geometry';
import type { DrawnBand } from './scene-frame';

const ALPHA_CHANNEL = 3;

function band(stretchMeters: number): DrawnBand {
  return { anchor: { x: 0, y: 0 }, pull: { x: 0, y: -stretchMeters }, meterOnBoard: 1 };
}

function dotAlpha(stretchMeters: number, pending = false): number {
  const writer = new MeshWriter();
  writePreviewDots(writer, [{ x: 1, y: 1 }], { band: band(stretchMeters), pending });
  const { vertexData } = writer.finish();
  return new DataView(vertexData).getUint8(MESH_COLOR_OFFSET_BYTES + ALPHA_CHANNEL);
}

describe('writePreviewDots', () => {
  it('draws the path brighter the harder the band is pulled', () => {
    const softest = dotAlpha(AIM_DEAD_ZONE_METERS);
    const middle = dotAlpha((AIM_DEAD_ZONE_METERS + MAX_PULL_METERS) / 2);
    const strongest = dotAlpha(MAX_PULL_METERS);

    expect(middle).toBeGreaterThan(softest);
    expect(strongest).toBeGreaterThan(middle);
  });

  it('brightens the grey dots of a ball still moving the same way', () => {
    expect(dotAlpha(MAX_PULL_METERS, true)).toBeGreaterThan(dotAlpha(AIM_DEAD_ZONE_METERS, true));
  });
});
