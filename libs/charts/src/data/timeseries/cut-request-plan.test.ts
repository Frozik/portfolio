import { describe, expect, it } from 'vitest';

import { piecesOf } from './cut-request-plan';

const STEP = 60n;
/** A cut longer than four elements splits the request. */
const REQUEST_WORTH = 4;
const bounds = { from: 0n, to: 3000n, includeFrom: true, includeTo: true };
const planning = { step: STEP, aggregateTime: 'start' as const, requestWorth: REQUEST_WORTH };

describe('splitting a request at the cuts', () => {
  it('asks the bounds whole, naming the cuts to skip, when no cut is worth going round', () => {
    const cuts = [
      { from: 600n, to: 780n },
      { from: 1500n, to: 1740n },
    ];

    expect(piecesOf(bounds, cuts, planning)).toEqual([{ ...bounds, skip: cuts }]);
  });

  it('splits at a cut that would bring back more elements than a request is worth', () => {
    const cuts = [{ from: 1200n, to: 1800n }];

    expect(piecesOf(bounds, cuts, planning)).toEqual([
      { from: 0n, to: 1200n, includeFrom: true, includeTo: false, skip: [] },
      { from: 1740n, to: 3000n, includeFrom: false, includeTo: true, skip: [] },
    ]);
  });

  it('reaches one step into the cut for the bar that starts inside it and runs out of it', () => {
    const cuts = [{ from: 1200n, to: 1800n }];
    const [, after] = piecesOf(bounds, cuts, planning);
    const [before] = piecesOf(bounds, cuts, { ...planning, aggregateTime: 'end' });

    expect(after.from).toBe(1800n - STEP);
    expect(before.to).toBe(1200n + STEP);
  });

  it('keeps an open stretch shorter than a request is worth joined to its neighbour', () => {
    const cuts = [
      { from: 600n, to: 1500n },
      { from: 1620n, to: 2520n },
    ];

    expect(piecesOf(bounds, cuts, planning)).toEqual([
      { from: 0n, to: 600n, includeFrom: true, includeTo: false, skip: [] },
      {
        from: 1440n,
        to: 3000n,
        includeFrom: false,
        includeTo: true,
        skip: [{ from: 1620n, to: 2520n }],
      },
    ]);
  });

  it('joins a short last stretch to the piece before it', () => {
    const cuts = [{ from: 1200n, to: 2880n }];

    expect(piecesOf(bounds, cuts, planning)).toEqual([{ ...bounds, skip: cuts }]);
  });

  it('clips a cut that runs past the bounds and skips what is inside', () => {
    const cuts = [{ from: 2400n, to: 4000n }];

    expect(piecesOf(bounds, cuts, planning)).toEqual([
      { ...bounds, skip: [{ from: 2400n, to: 3000n }] },
    ]);
  });
});
