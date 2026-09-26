import { MAX_CONCURRENT_LOADS } from '../domain/constants';
import type { TileAtlasPort } from '../domain/ports/tile-atlas';
import type { TileSource } from '../domain/ports/tile-source';
import type { TileStore } from '../domain/ports/tile-store';
import { ResidentTileIndex } from '../domain/resident-tile-index';
import type { TileCoord, TileKey } from '../domain/tile-key';
import { tileKeyOf } from '../domain/tile-key';
import type { SelectedTile } from '../domain/tile-selection';
import type { TileLoaderOptions } from './tile-loader';
import { TileLoader } from './tile-loader';

interface PendingLoad {
  readonly coord: TileCoord;
  readonly signal: AbortSignal;
  readonly resolve: (bytes: Blob) => void;
  readonly reject: (error: Error) => void;
}

function fakeBlob(): Blob {
  return { size: 1000 } as Blob;
}

function fakeImage(): ImageBitmap & { readonly close: ReturnType<typeof vi.fn> } {
  return { close: vi.fn() } as unknown as ImageBitmap & {
    readonly close: ReturnType<typeof vi.fn>;
  };
}

function createFakeSource() {
  const pending: PendingLoad[] = [];
  const source: TileSource = {
    loadTile: (coord, signal) =>
      new Promise<Blob>((resolve, reject) => {
        pending.push({ coord, signal, resolve, reject });
      }),
  };
  return { source, pending };
}

function createFakeAtlas(): TileAtlasPort & {
  readonly stored: TileKey[];
  readonly layers: Map<TileKey, number>;
} {
  const layers = new Map<TileKey, number>();
  const stored: TileKey[] = [];
  return {
    stored,
    layers,
    store(key) {
      layers.set(key, layers.size);
      stored.push(key);
    },
    layerOf: key => layers.get(key),
    has: key => layers.has(key),
    touch: () => undefined,
    coverage: new ResidentTileIndex(),
  };
}

function createFakeStore(): TileStore {
  const bytes = new Map<TileKey, Blob>();
  return {
    get: key => Promise.resolve(bytes.get(key)),
    set: (key, blob) => {
      bytes.set(key, blob);
      return Promise.resolve();
    },
  };
}

function createLoader(overrides: Partial<TileLoaderOptions<ImageBitmap>> = {}) {
  const { source, pending } = createFakeSource();
  const atlas = createFakeAtlas();
  const store = createFakeStore();
  const onChange = vi.fn();
  const decoded: ReturnType<typeof fakeImage>[] = [];
  const loader = new TileLoader<ImageBitmap>({
    source,
    sink: atlas,
    store,
    decode: () => {
      const image = fakeImage();
      decoded.push(image);
      return Promise.resolve(image);
    },
    release: image => image.close(),
    readNow: () => 3,
    onChange,
    ...overrides,
  });
  return { loader, pending, atlas, store, onChange, decoded };
}

function selected(x: number, screenDistancePx: number): SelectedTile {
  const coord = { z: 4, x, y: 1 };
  return { key: tileKeyOf(coord), coord, edgePx: 300, screenDistancePx };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 8; tick++) {
    await Promise.resolve();
  }
}

describe('TileLoader', () => {
  it('fetches the tiles nearest the screen centre first, decodes and uploads them, then closes the image', async () => {
    const { loader, pending, atlas, onChange, decoded } = createLoader();
    const near = selected(0, 100);
    const far = selected(1, 500);

    loader.reconcile([far, near], 0);
    await settle();
    pending[0].resolve(fakeBlob());
    await settle();

    expect(pending[0].coord).toEqual(near.coord);
    expect(atlas.stored).toEqual([near.key]);
    expect(decoded[0].close).toHaveBeenCalled();
    expect(loader.readyTile(near.key)).toEqual({ fadeStart: 3 });
    expect(loader.readyTile(far.key)).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('lets a fetch finish after its tile left the view and keeps the picture for its return', async () => {
    const { loader, pending, atlas } = createLoader();
    const tile = selected(0, 100);

    loader.reconcile([tile], 0);
    await settle();
    loader.reconcile([], 1);
    pending[0].resolve(fakeBlob());
    await settle();

    expect(pending[0].signal.aborted).toBe(false);
    expect(atlas.stored).toEqual([tile.key]);
    expect(loader.readyTile(tile.key)).toBeDefined();
  });

  it('aborts an out-of-view fetch when a tile in view needs its slot and ignores the late result', async () => {
    const { loader, pending, atlas, decoded } = createLoader();
    const outOfView = Array.from({ length: MAX_CONCURRENT_LOADS }, (_, index) =>
      selected(index, 100 + index)
    );
    const inView = selected(MAX_CONCURRENT_LOADS, 0);

    loader.reconcile(outOfView, 0);
    await settle();
    loader.reconcile([inView], 1);
    await settle();
    const aborted = pending.filter(load => load.signal.aborted);
    aborted[0].resolve(fakeBlob());
    await settle();

    expect(aborted).toHaveLength(1);
    expect(pending.at(-1)?.coord).toEqual(inView.coord);
    expect(atlas.stored).toEqual([]);
    expect(decoded[0]?.close).toHaveBeenCalled();
  });

  it('keeps the network within the concurrency cap and backfills as loads finish', async () => {
    const { loader, pending } = createLoader();
    const tiles = Array.from({ length: MAX_CONCURRENT_LOADS + 2 }, (_, index) =>
      selected(index, index)
    );

    loader.reconcile(tiles, 0);
    await settle();
    expect(pending).toHaveLength(MAX_CONCURRENT_LOADS);

    pending[0].resolve(fakeBlob());
    await settle();
    loader.reconcile(tiles, 1);
    await settle();

    expect(pending).toHaveLength(MAX_CONCURRENT_LOADS + 1);
    expect(loader.pendingCount).toBe(tiles.length - 1);
  });

  it('records a failure instead of throwing and says when to try again', async () => {
    const { loader, pending, onChange } = createLoader({ readNow: () => 0 });
    const tile = selected(0, 500);

    loader.reconcile([tile], 0);
    await settle();
    pending[0].reject(new Error('404'));
    await settle();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(loader.readyTile(tile.key)).toBeUndefined();
    expect(loader.nextRetryAt).toBeGreaterThan(0);
    loader.reconcile([tile], 1);
    await settle();
    expect(pending).toHaveLength(1);
  });

  it('restores an atlas-evicted tile from the store without the network or a fade', async () => {
    const { loader, pending, atlas } = createLoader();
    const tile = selected(0, 500);

    loader.reconcile([tile], 0);
    await settle();
    pending[0].resolve(fakeBlob());
    await settle();

    atlas.layers.clear();
    loader.reconcile([tile], 1);
    await settle();

    expect(pending).toHaveLength(1);
    expect(loader.readyTile(tile.key)).toEqual({ fadeStart: Number.NEGATIVE_INFINITY });
  });

  it('aborts everything on dispose', async () => {
    const { loader, pending } = createLoader();

    loader.reconcile([selected(0, 500), selected(1, 400)], 0);
    await settle();
    loader.dispose();

    expect(pending).toHaveLength(2);
    expect(pending.every(load => load.signal.aborted)).toBe(true);
  });
});
