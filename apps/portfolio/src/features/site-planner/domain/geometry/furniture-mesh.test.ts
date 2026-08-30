import { describe, expect, it } from 'vitest';

import { FURNITURE_CATALOG } from '../model/furniture';
import { buildFurnitureTemplate } from './furniture-mesh';

/**
 * Small details — a door handle, a tank lid — may stand a hand's width proud
 * of the body; the body itself must fill the catalogue box exactly.
 */
const PROTRUSION_TOLERANCE_METERS = 0.03;
const FIT_TOLERANCE_METERS = 0.12;

describe('buildFurnitureTemplate', () => {
  for (const entry of FURNITURE_CATALOG) {
    it(`sculpts «${entry.id}» to the catalogue's real dimensions`, () => {
      const mesh = buildFurnitureTemplate(entry);

      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.colors.length).toBe(mesh.positions.length);

      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let minZ = Number.POSITIVE_INFINITY;
      let maxZ = Number.NEGATIVE_INFINITY;

      for (let index = 0; index < mesh.positions.length; index += 3) {
        minX = Math.min(minX, mesh.positions[index]);
        maxX = Math.max(maxX, mesh.positions[index]);
        minY = Math.min(minY, mesh.positions[index + 1]);
        maxY = Math.max(maxY, mesh.positions[index + 1]);
        minZ = Math.min(minZ, mesh.positions[index + 2]);
        maxZ = Math.max(maxZ, mesh.positions[index + 2]);
      }

      const halfWidth = entry.widthMeters / 2;
      const halfDepth = entry.depthMeters / 2;

      // Nothing reaches outside the box (small hardware aside)…
      expect(minX).toBeGreaterThanOrEqual(-halfWidth - PROTRUSION_TOLERANCE_METERS);
      expect(maxX).toBeLessThanOrEqual(halfWidth + PROTRUSION_TOLERANCE_METERS);
      expect(minZ).toBeGreaterThanOrEqual(-halfDepth - PROTRUSION_TOLERANCE_METERS);
      expect(maxZ).toBeLessThanOrEqual(halfDepth + PROTRUSION_TOLERANCE_METERS);
      expect(minY).toBeGreaterThanOrEqual(-1e-6);
      expect(maxY).toBeLessThanOrEqual(entry.heightMeters + PROTRUSION_TOLERANCE_METERS);
      // …and the body actually fills it: the piece is as wide, deep and tall
      // as the real thing it stands for.
      expect(maxX - minX).toBeGreaterThanOrEqual(entry.widthMeters - FIT_TOLERANCE_METERS);
      expect(maxZ - minZ).toBeGreaterThanOrEqual(entry.depthMeters - FIT_TOLERANCE_METERS);
      expect(maxY).toBeGreaterThanOrEqual(entry.heightMeters - FIT_TOLERANCE_METERS);
    });
  }
});
