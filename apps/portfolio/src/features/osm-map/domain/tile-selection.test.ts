import { MAX_TILES_PER_FRAME } from './constants';
import { distanceToGroundRect } from './frustum';
import type { PixelPoint, Viewport } from './map-camera';
import { cameraGeometry, createMapCamera, unprojectToGround } from './map-camera';
import { DEFAULT_VIEW } from './map-view';
import type { TileCoord } from './tile-key';
import { tileBounds } from './tile-key';
import type { SelectedTile } from './tile-selection';
import { compareByScreenDistance, selectTiles } from './tile-selection';

const VIEWPORT: Viewport = { widthPx: 1600, heightPx: 900 };
const FULL_DETAIL = 1;

function containsGround(coord: TileCoord, point: { x: number; y: number }): boolean {
  const bounds = tileBounds(coord);
  return (
    point.x >= bounds.minX &&
    point.x < bounds.maxX &&
    point.y >= bounds.minY &&
    point.y < bounds.maxY
  );
}

function tilesUnder(tiles: readonly SelectedTile[], point: { x: number; y: number }) {
  return tiles.filter(tile => containsGround(tile.coord, point));
}

function samplePixels(): PixelPoint[] {
  const pixels: PixelPoint[] = [];
  for (let x = 10; x < VIEWPORT.widthPx; x += 200) {
    for (let y = 10; y < VIEWPORT.heightPx; y += 100) {
      pixels.push({ x, y });
    }
  }
  return pixels;
}

describe('tile selection', () => {
  it('picks one uniform zoom level equal to the camera zoom when looking straight down', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 0 });
    const tiles = selectTiles(cameraGeometry(state, VIEWPORT), FULL_DETAIL);

    expect(tiles.length).toBeGreaterThan(0);
    expect(new Set(tiles.map(tile => tile.coord.z))).toEqual(new Set([DEFAULT_VIEW.zoom]));
  });

  it('covers every visible ground point with exactly one tile', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 60, bearingDeg: 40 });
    const tiles = selectTiles(cameraGeometry(state, VIEWPORT), FULL_DETAIL);

    for (const pixel of samplePixels()) {
      const ground = unprojectToGround(state, VIEWPORT, pixel);
      if (ground !== undefined) {
        expect(tilesUnder(tiles, ground)).toHaveLength(1);
      }
    }
  });

  it('uses finer tiles near the camera than toward the horizon', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 60 });
    const tiles = selectTiles(cameraGeometry(state, VIEWPORT), FULL_DETAIL);
    const near = unprojectToGround(state, VIEWPORT, { x: 800, y: 880 });
    const far = unprojectToGround(state, VIEWPORT, { x: 800, y: 380 });

    const nearZoom = tilesUnder(tiles, near ?? { x: -1, y: -1 })[0].coord.z;
    const farZoom = tilesUnder(tiles, far ?? { x: -1, y: -1 })[0].coord.z;

    expect(nearZoom).toBeGreaterThan(farZoom);
    expect(tiles[0].edgePx).toBeGreaterThanOrEqual(tiles[tiles.length - 1].edgePx);
  });

  it('ranks the tile under the screen centre first and the ones at the edges last', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 60, bearingDeg: 40 });
    const tiles = selectTiles(cameraGeometry(state, VIEWPORT), FULL_DETAIL);
    const centre = unprojectToGround(state, VIEWPORT, {
      x: VIEWPORT.widthPx / 2,
      y: VIEWPORT.heightPx / 2,
    });
    const corner = unprojectToGround(state, VIEWPORT, { x: 10, y: VIEWPORT.heightPx - 10 });
    const ranked = tiles.toSorted(compareByScreenDistance);

    expect(tilesUnder(tiles, centre ?? { x: -1, y: -1 })[0]).toBe(ranked[0]);
    expect(ranked.indexOf(tilesUnder(tiles, corner ?? { x: -1, y: -1 })[0])).toBeGreaterThan(
      ranked.length / 2
    );
  });

  it('never selects a tile that starts beyond the fog', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 65 });
    const geometry = cameraGeometry(state, VIEWPORT);
    const tiles = selectTiles(geometry, FULL_DETAIL);

    for (const tile of tiles) {
      expect(distanceToGroundRect(geometry.position, tileBounds(tile.coord))).toBeLessThanOrEqual(
        geometry.fogEnd
      );
    }
  });

  it('stays within the per-frame budget on a 4K display at maximum pitch', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 65 });
    const geometry = cameraGeometry(state, { widthPx: 3840, heightPx: 2160 });

    expect(selectTiles(geometry, FULL_DETAIL).length).toBeLessThanOrEqual(MAX_TILES_PER_FRAME);
  });

  it('selects coarser tiles at half detail', () => {
    const geometry = cameraGeometry(createMapCamera(DEFAULT_VIEW), VIEWPORT);

    const full = selectTiles(geometry, FULL_DETAIL);
    const half = selectTiles(geometry, 0.5);

    expect(half.length).toBeLessThan(full.length);
  });
});
