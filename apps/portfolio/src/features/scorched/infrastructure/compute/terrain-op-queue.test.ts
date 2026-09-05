import { describe, expect, it } from 'vitest';

import type { WorldEvent } from '../../domain/types';
import { toPlayerId } from '../../domain/types';
import { FLOATS_PER_CARVE_OP } from '../render-constants';
import {
  CARVE_OP_KIND,
  estimateCollapseTicks,
  TerrainOpQueue,
  toCarveOpKind,
  writeCarveOps,
} from './terrain-op-queue';

function createCarveEvent(radiusWu: number): WorldEvent {
  return {
    type: 'terrain-carved',
    shape: 'circle',
    center: { x: 100, y: 200 },
    radiusWu,
  };
}

describe('toCarveOpKind', () => {
  it('maps every domain carve shape onto a shader kind', () => {
    expect(toCarveOpKind('circle')).toBe(CARVE_OP_KIND.circle);
    expect(toCarveOpKind('wedge')).toBe(CARVE_OP_KIND.wedge);
  });
});

describe('estimateCollapseTicks', () => {
  it('grows with the drop but never below the settle margin', () => {
    const shortDrop = estimateCollapseTicks(0);
    const longDrop = estimateCollapseTicks(200);

    expect(shortDrop).toBeGreaterThan(0);
    expect(longDrop).toBeGreaterThan(shortDrop);
  });

  it('treats a negative drop as no drop at all', () => {
    expect(estimateCollapseTicks(-50)).toBe(estimateCollapseTicks(0));
  });
});

describe('TerrainOpQueue', () => {
  it('turns a carve event into a stamp centred on the blast', () => {
    const queue = new TerrainOpQueue();

    queue.consume([createCarveEvent(20)]);

    expect(queue.takeOps(10)).toEqual([
      { centerX: 100, centerY: 200, radiusWu: 20, kind: CARVE_OP_KIND.circle },
    ]);
  });

  it('leaves the laser alone: an instant beam moves no dirt', () => {
    const queue = new TerrainOpQueue();

    queue.consume([
      { type: 'laser-fired', ownerId: toPlayerId(0), from: { x: 0, y: 0 }, to: { x: 800, y: 200 } },
    ]);

    expect(queue.takeOps(10)).toHaveLength(0);
  });

  it('turns a deposit event into a deposit stamp', () => {
    const queue = new TerrainOpQueue();

    queue.consume([{ type: 'terrain-deposited', center: { x: 10, y: 20 }, radiusWu: 35 }]);

    expect(queue.takeOps(10)[0].kind).toBe(CARVE_OP_KIND.deposit);
  });

  it('hands out no more ops than asked for and keeps the rest', () => {
    const queue = new TerrainOpQueue();

    queue.consume([createCarveEvent(10), createCarveEvent(10), createCarveEvent(10)]);

    expect(queue.takeOps(2)).toHaveLength(2);
    expect(queue.takeOps(2)).toHaveLength(1);
    expect(queue.takeOps(2)).toHaveLength(0);
  });

  it('asks for enough collapse ticks to cover the largest stamp', () => {
    const queue = new TerrainOpQueue();

    queue.consume([createCarveEvent(10), createCarveEvent(60)]);

    expect(queue.takeCollapseTicks()).toBe(estimateCollapseTicks(120));
    expect(queue.takeCollapseTicks()).toBe(0);
  });

  it('requests a full upload when suspended dirt drops', () => {
    const queue = new TerrainOpQueue();

    queue.consume([{ type: 'dirt-settled', columns: [1, 2, 3] }]);

    expect(queue.takeFullSyncRequest()).toBe(true);
    expect(queue.takeFullSyncRequest()).toBe(false);
  });

  it('ignores events that leave the terrain untouched', () => {
    const queue = new TerrainOpQueue();

    queue.consume([
      { type: 'turn-started', playerId: toPlayerId(0) },
      { type: 'dirt-settled', columns: [] },
    ]);

    expect(queue.takeOps(10)).toHaveLength(0);
    expect(queue.takeFullSyncRequest()).toBe(false);
  });

  it('forgets everything pending when the round is replaced', () => {
    const queue = new TerrainOpQueue();

    queue.consume([createCarveEvent(20)]);
    queue.clear();

    expect(queue.takeOps(10)).toHaveLength(0);
    expect(queue.takeCollapseTicks()).toBe(0);
  });
});

describe('writeCarveOps', () => {
  it('packs each op into its own slot of the shader layout', () => {
    const ops = [
      { centerX: 1, centerY: 2, radiusWu: 5, kind: CARVE_OP_KIND.wedge },
      { centerX: 6, centerY: 7, radiusWu: 8, kind: CARVE_OP_KIND.deposit },
    ];
    const packed = new Float32Array(ops.length * FLOATS_PER_CARVE_OP);

    writeCarveOps(packed, ops);

    expect([...packed.slice(0, FLOATS_PER_CARVE_OP)]).toEqual([1, 2, 5, CARVE_OP_KIND.wedge]);
    expect([...packed.slice(FLOATS_PER_CARVE_OP, 2 * FLOATS_PER_CARVE_OP)]).toEqual([
      6,
      7,
      8,
      CARVE_OP_KIND.deposit,
    ]);
  });
});
