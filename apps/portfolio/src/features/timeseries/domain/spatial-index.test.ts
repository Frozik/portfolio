import { createSpatialIndex, insertPart, queryVisibleParts } from './spatial-index';
import type { IDataPart } from './types';
import { ETimeScale } from './types';

function createDataPart(overrides: Partial<IDataPart> = {}): IDataPart {
  return {
    scale: ETimeScale.Day,
    timeStart: 0,
    timeEnd: 100,
    baseTime: 0,
    baseValue: 0,
    textureRowStart: 0,
    pointCount: 0,
    valueMin: 0,
    valueMax: 0,
    pointTimes: new Float64Array(0),
    pointValues: new Float64Array(0),
    ...overrides,
  };
}

describe('createSpatialIndex', () => {
  it('creates an empty spatial index', () => {
    const tree = createSpatialIndex();

    expect(tree).toBeDefined();
    expect(tree.all()).toHaveLength(0);
  });
});

describe('insertPart + queryVisibleParts', () => {
  it('returns nothing when querying an empty index', () => {
    const tree = createSpatialIndex();

    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(0);
  });

  it('inserts and retrieves a single part', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Hour,
      timeStart: 10,
      timeEnd: 50,
    });

    insertPart(tree, part);
    const results = queryVisibleParts(tree, ETimeScale.Hour, 0, 100);

    expect(results).toHaveLength(1);
    expect(results[0].part).toBe(part);
  });

  it('does not return parts with a different scale', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 10,
      timeEnd: 50,
    });

    insertPart(tree, part);
    const results = queryVisibleParts(tree, ETimeScale.Minute, 0, 100);

    expect(results).toHaveLength(0);
  });

  it('filters parts by scale when multiple scales are present', () => {
    const tree = createSpatialIndex();
    const hourPart = createDataPart({
      scale: ETimeScale.Hour,
      timeStart: 0,
      timeEnd: 100,
    });
    const dayPart = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 0,
      timeEnd: 100,
    });
    const minutePart = createDataPart({
      scale: ETimeScale.Minute,
      timeStart: 0,
      timeEnd: 100,
    });

    insertPart(tree, hourPart);
    insertPart(tree, dayPart);
    insertPart(tree, minutePart);

    const results = queryVisibleParts(tree, ETimeScale.Hour, 0, 100);

    expect(results).toHaveLength(1);
    expect(results[0].part).toBe(hourPart);
  });

  it('returns only parts within the queried time range', () => {
    const tree = createSpatialIndex();
    const partInRange = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 20,
      timeEnd: 80,
    });
    const partOutOfRange = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 200,
      timeEnd: 300,
    });

    insertPart(tree, partInRange);
    insertPart(tree, partOutOfRange);
    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(1);
    expect(results[0].part).toBe(partInRange);
  });

  it('returns overlapping parts that partially intersect the query range', () => {
    const tree = createSpatialIndex();
    const partOverlappingStart = createDataPart({
      scale: ETimeScale.Day,
      timeStart: -50,
      timeEnd: 10,
    });
    const partOverlappingEnd = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 90,
      timeEnd: 150,
    });
    const partFullyInside = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 30,
      timeEnd: 60,
    });

    insertPart(tree, partOverlappingStart);
    insertPart(tree, partOverlappingEnd);
    insertPart(tree, partFullyInside);
    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(3);
    const parts = results.map(r => r.part);
    expect(parts).toContain(partOverlappingStart);
    expect(parts).toContain(partOverlappingEnd);
    expect(parts).toContain(partFullyInside);
  });

  it('returns a part whose boundaries exactly match the query range', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 0,
      timeEnd: 100,
    });

    insertPart(tree, part);
    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(1);
    expect(results[0].part).toBe(part);
  });

  it('returns a part when query range touches its boundary at a single point', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 100,
      timeEnd: 200,
    });

    insertPart(tree, part);
    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(1);
    expect(results[0].part).toBe(part);
  });

  it('does not return a part completely outside the query range', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Day,
      timeStart: 101,
      timeEnd: 200,
    });

    insertPart(tree, part);
    const results = queryVisibleParts(tree, ETimeScale.Day, 0, 100);

    expect(results).toHaveLength(0);
  });

  it('stores spatial item fields correctly', () => {
    const tree = createSpatialIndex();
    const part = createDataPart({
      scale: ETimeScale.Month,
      timeStart: 42,
      timeEnd: 99,
    });

    insertPart(tree, part);
    const items = tree.all();

    expect(items).toHaveLength(1);
    expect(items[0].minX).toBe(42);
    expect(items[0].maxX).toBe(99);
    expect(items[0].minY).toBe(ETimeScale.Month);
    expect(items[0].maxY).toBe(ETimeScale.Month);
    expect(items[0].part).toBe(part);
  });
});
