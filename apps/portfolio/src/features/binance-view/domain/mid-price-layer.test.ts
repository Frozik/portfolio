import {
  MID_PRICE_MAX_WIDTH_PX,
  MID_PRICE_MIN_WIDTH_PX,
  MID_PRICE_TEXTURE_WIDTH,
  MID_PRICE_WIDTH_SCALE,
} from './constants';
import type { IMidPriceVisibleBlock } from './mid-price-layer';
import {
  MID_PRICE_BLOCK_DESCRIPTOR_BYTES,
  MID_PRICE_UNIFORMS_BYTES,
  writeMidPriceBlockDescriptors,
  writeMidPriceUniforms,
} from './mid-price-layer';
import type { IMidPriceBlockIndexItem } from './mid-price-types';
import type { UnixTimeMs } from './types';

interface ICaptured {
  readonly buffer: unknown;
  readonly offset: number;
  readonly data: ArrayBuffer;
}

function createMockDevice(): {
  device: GPUDevice;
  captured: ICaptured[];
} {
  const captured: ICaptured[] = [];
  const queue = {
    writeBuffer(buffer: unknown, offset: number, data: BufferSource) {
      const copy = new ArrayBuffer((data as ArrayBuffer).byteLength);
      new Uint8Array(copy).set(new Uint8Array(data as ArrayBuffer));
      captured.push({ buffer, offset, data: copy });
    },
  };
  const device = { queue } as unknown as GPUDevice;
  return { device, captured };
}

function createMockBuffer(size: number): GPUBuffer {
  return { size } as unknown as GPUBuffer;
}

function makeBlockItem(
  blockId: number,
  count: number,
  basePrice: number,
  first = blockId,
  last = blockId + 100
): IMidPriceBlockIndexItem {
  return {
    blockId: blockId as UnixTimeMs,
    firstTimestampMs: first as UnixTimeMs,
    lastTimestampMs: last as UnixTimeMs,
    basePrice,
    count,
    textureRowIndex: 0,
  };
}

describe('writeMidPriceUniforms', () => {
  it('packs every scalar into the 64-byte uniform block at the documented slots', () => {
    const { device, captured } = createMockDevice();
    const buffer = createMockBuffer(MID_PRICE_UNIFORMS_BYTES);

    writeMidPriceUniforms(device, buffer, {
      canvasWidth: 1920,
      canvasHeight: 1080,
      plotWidthPx: 1770,
      viewTimeStartDeltaMs: 1000,
      viewTimeEndDeltaMs: 61000,
      priceMin: 50_000,
      priceMax: 60_000,
      blockCount: 3,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].data.byteLength).toBe(MID_PRICE_UNIFORMS_BYTES);
    const floats = new Float32Array(captured[0].data);
    const uints = new Uint32Array(captured[0].data);

    expect(floats[0]).toBe(1920);
    expect(floats[1]).toBe(1080);
    expect(floats[2]).toBe(1770);
    expect(floats[3]).toBe(1000);
    expect(floats[4]).toBe(61000);
    expect(floats[5]).toBe(50_000);
    expect(floats[6]).toBe(60_000);
    expect(floats[7]).toBe(MID_PRICE_MIN_WIDTH_PX);
    expect(floats[8]).toBe(MID_PRICE_MAX_WIDTH_PX);
    expect(floats[9]).toBe(MID_PRICE_WIDTH_SCALE);
    expect(uints[10]).toBe(3);
    expect(uints[11]).toBe(MID_PRICE_TEXTURE_WIDTH);
  });
});

describe('writeMidPriceBlockDescriptors', () => {
  it('returns zero totals for an empty block list and emits no GPU writes', () => {
    const { device, captured } = createMockDevice();
    const buffer = createMockBuffer(MID_PRICE_BLOCK_DESCRIPTOR_BYTES);
    const result = writeMidPriceBlockDescriptors(device, buffer, [], 0);
    expect(result).toEqual({ totalSamples: 0, totalSegments: 0 });
    expect(captured).toHaveLength(0);
  });

  it('writes one 16-byte descriptor per block in input order', () => {
    const { device, captured } = createMockDevice();
    const buffer = createMockBuffer(MID_PRICE_BLOCK_DESCRIPTOR_BYTES * 4);

    const visibleBlocks: IMidPriceVisibleBlock[] = [
      { item: makeBlockItem(1_000_000, 10, 50_000), textureOffset: 0 },
      { item: makeBlockItem(1_000_256, 5, 50_100), textureOffset: 256 },
    ];
    const result = writeMidPriceBlockDescriptors(device, buffer, visibleBlocks, 1_000_000);

    expect(result).toEqual({ totalSamples: 15, totalSegments: 13 });

    const { data } = captured[0];
    expect(data.byteLength).toBe(MID_PRICE_BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length);
    const uints = new Uint32Array(data);
    const floats = new Float32Array(data);
    // Block 0
    expect(uints[0]).toBe(0);
    expect(uints[1]).toBe(10);
    expect(floats[2]).toBe(0);
    expect(floats[3]).toBe(50_000);
    // Block 1
    expect(uints[4]).toBe(256);
    expect(uints[5]).toBe(5);
    expect(floats[6]).toBe(256);
    expect(floats[7]).toBe(50_100);
  });

  it('counts a block of 1 sample as 0 segments, blocks of count N>=2 as N-1 segments', () => {
    const { device } = createMockDevice();
    const buffer = createMockBuffer(MID_PRICE_BLOCK_DESCRIPTOR_BYTES * 3);

    const result = writeMidPriceBlockDescriptors(
      device,
      buffer,
      [
        { item: makeBlockItem(1000, 1, 50_000), textureOffset: 0 },
        { item: makeBlockItem(2000, 3, 50_100), textureOffset: 256 },
        { item: makeBlockItem(3000, 10, 50_200), textureOffset: 512 },
      ],
      1000
    );

    expect(result.totalSamples).toBe(14);
    expect(result.totalSegments).toBe(0 + 2 + 9);
  });
});
