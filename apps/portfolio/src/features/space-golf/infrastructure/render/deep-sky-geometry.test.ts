import { describe, expect, it } from 'vitest';

import { advanceDeepSky, brightnessOf, createDeepSky } from './deep-sky';
import { buildDeepSkyMesh } from './deep-sky-geometry';
import { FRAMED_KIND_OFFSET_BYTES, FRAMED_VERTEX_STRIDE_BYTES } from './framed-mesh-writer';

const VISIBLE = { min: { x: -3, y: 40 }, max: { x: 3, y: 53 } };
const VERTICES_PER_QUAD = 6;
const BYTE_MAX = 255;

function kindsOf(mesh: { vertexData: ArrayBuffer; vertexCount: number }) {
  const view = new DataView(mesh.vertexData);
  const kinds: { painting: number; tint: number; burning: number }[] = [];
  for (let index = 0; index < mesh.vertexCount; index += VERTICES_PER_QUAD) {
    const at = index * FRAMED_VERTEX_STRIDE_BYTES + FRAMED_KIND_OFFSET_BYTES;
    kinds.push({
      painting: view.getUint8(at),
      tint: view.getUint8(at + 1),
      burning: view.getUint8(at + 2),
    });
  }
  return kinds;
}

describe('the deep sky as the shader is given it', () => {
  it('sends one quad for every far thing that is burning, and none for one that is not', () => {
    const sky = createDeepSky(7, VISIBLE);
    const alight = sky.objects.filter(object => brightnessOf(object) > 0);

    const mesh = buildDeepSkyMesh(sky);

    expect(alight.length).toBeGreaterThan(0);
    expect(alight.length).toBeLessThan(sky.objects.length);
    expect(mesh.vertexCount).toBe(alight.length * VERTICES_PER_QUAD);
  });

  it('says which painting to do, in which colours and how brightly', () => {
    const sky = advanceDeepSky(createDeepSky(3, VISIBLE), 5, VISIBLE);

    const kinds = kindsOf(buildDeepSkyMesh(sky));

    for (const kind of kinds) {
      expect([0, BYTE_MAX]).toContain(kind.painting);
      expect(kind.tint).toBeGreaterThanOrEqual(0);
      expect(kind.tint).toBeLessThanOrEqual(BYTE_MAX);
      expect(kind.burning).toBeGreaterThan(0);
      expect(kind.burning).toBeLessThanOrEqual(BYTE_MAX);
    }
  });

  it('gives each of them the disc it is painted in: its own half length and half width', () => {
    const sky = createDeepSky(3, VISIBLE);
    const alight = sky.objects.filter(object => brightnessOf(object) > 0);

    const view = new DataView(buildDeepSkyMesh(sky).vertexData);
    alight.forEach((object, index) => {
      const at = index * VERTICES_PER_QUAD * FRAMED_VERTEX_STRIDE_BYTES + 8;
      expect(view.getFloat32(at + 8, true)).toBeCloseTo(object.radiusMeters);
      expect(view.getFloat32(at + 12, true)).toBeCloseTo(object.radiusMeters * object.squash);
    });
  });
});
