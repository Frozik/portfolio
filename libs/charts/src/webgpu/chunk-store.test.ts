import { describe, expect, it, vi } from 'vitest';

import type { TRun } from '../core/series/point-run';
import type { IStyle, IStyledRun } from '../core/series/style-processor';
import { ChunkStore } from './chunk-store';
import type { DataTexture } from './data-texture';
import { SLOT_TEXELS } from './slot-layout';

const STYLE: IStyle = { marks: [], fill: { color: 1, size: 1 }, stroke: { color: 0, size: 0 } };

function styledPoints(length: number, revision = 0, styleRevision = 0): IStyledRun<unknown> {
  const run: TRun<unknown, 'point'> = {
    id: 1,
    revision,
    step: undefined,
    aggregateTime: 'start',
    breakMarkers: [],
    shape: 'point',
    length,
    x: new BigInt64Array(length),
    value: new Float64Array(length),
  };
  return { run, style: STYLE, styleRevision };
}

function fakeTexture(capacity = 100) {
  let next = 0;
  const write = vi.fn();
  const release = vi.fn();
  const texture = {
    acquire: () => (next < capacity ? next++ : undefined),
    touch: vi.fn(),
    release,
    texelOf: (slot: number) => slot * SLOT_TEXELS,
    write,
  } as unknown as DataTexture;
  return { texture, write, release };
}

describe('ChunkStore', () => {
  it('uploads only the chunks that are drawn, 128 points to a slot', () => {
    const { texture, write } = fakeTexture();
    const store = new ChunkStore(texture);

    const refs = store.resident('series:1', styledPoints(1000), 200, 300);

    expect(refs).toEqual([
      { texel: 0, count: 128 },
      { texel: SLOT_TEXELS, count: 128 },
    ]);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('writes a chunk once and draws it from the texture after that', () => {
    const { texture, write } = fakeTexture();
    const store = new ChunkStore(texture);
    const styled = styledPoints(100);

    store.resident('series:1', styled, 0, 100);
    store.resident('series:1', styled, 0, 100);

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('rewrites only the last chunk when the run grew at its end', () => {
    const { texture, write } = fakeTexture();
    const store = new ChunkStore(texture);
    store.resident('series:1', styledPoints(300), 0, 300);
    write.mockClear();

    const refs = store.resident('series:1', styledPoints(310, 1), 0, 310);

    expect(refs.at(-1)).toEqual({ texel: 2 * SLOT_TEXELS, count: 54 });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('rewrites every drawn chunk when the style changed', () => {
    const { texture, write } = fakeTexture();
    const store = new ChunkStore(texture);
    store.resident('series:1', styledPoints(300), 0, 300);
    write.mockClear();

    store.resident('series:1', styledPoints(300, 0, 1), 0, 300);

    expect(write).toHaveBeenCalledTimes(3);
  });

  it('uploads a chunk again after its slot was taken by eviction', () => {
    const { texture, write } = fakeTexture();
    const store = new ChunkStore(texture);
    const styled = styledPoints(100);
    store.resident('series:1', styled, 0, 100);

    store.evicted(0);
    store.resident('series:1', styled, 0, 100);

    expect(write).toHaveBeenCalledTimes(2);
  });

  it('stops at the first chunk the texture has no room for', () => {
    const { texture } = fakeTexture(1);
    const store = new ChunkStore(texture);

    expect(store.resident('series:1', styledPoints(1000), 0, 1000)).toHaveLength(1);
  });

  it('frees the slots of runs that are no longer shown', () => {
    const { texture, release } = fakeTexture();
    const store = new ChunkStore(texture);
    store.resident('gone:1', styledPoints(200), 0, 200);
    store.resident('kept:1', styledPoints(10), 0, 10);

    store.retain(new Set(['kept:1']));

    expect(release).toHaveBeenCalledTimes(2);
  });
});
