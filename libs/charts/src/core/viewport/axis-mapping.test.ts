import { describe, expect, it } from 'vitest';

import { cutsMapping } from './axis-mapping';
import { numberDomain } from './number-domain';
import { timeDomain } from './time-domain';

describe('an axis with cuts', () => {
  const mapping = cutsMapping(numberDomain, [
    { from: 10, to: 20 },
    { from: 40, to: 45 },
  ]);

  it('runs at the pace of the world between cuts and stands still across one', () => {
    expect(mapping.toVirtual(5)).toBe(5);
    expect(mapping.toVirtual(10)).toBe(10);
    expect(mapping.toVirtual(15)).toBe(10);
    expect(mapping.toVirtual(20)).toBe(10);
    expect(mapping.toVirtual(30)).toBe(20);
    expect(mapping.toVirtual(50)).toBe(35);
  });

  it('gives a world position back off the cuts, and the edge asked for on one', () => {
    expect(mapping.toWorld(5)).toBe(5);
    expect(mapping.toWorld(20)).toBe(30);
    expect(mapping.toWorld(35)).toBe(50);
    expect(mapping.toWorld(10)).toBe(20);
    expect(mapping.toWorld(10, 'before')).toBe(10);
  });

  it('tells a position strictly inside a cut from its edges', () => {
    expect(mapping.isCut(15)).toBe(true);
    expect(mapping.isCut(10)).toBe(false);
    expect(mapping.isCut(20)).toBe(false);
    expect(mapping.isCut(30)).toBe(false);
  });

  it('lists the cuts that fall into a virtual range, where they stand', () => {
    expect(mapping.cutsIn({ start: 0, end: 25 })).toEqual([
      { at: 10, from: 10, to: 20, openBefore: undefined },
    ]);
    expect(mapping.cutsIn({ start: 10, end: 30 })).toEqual([
      { at: 10, from: 10, to: 20, openBefore: undefined },
      { at: 30, from: 40, to: 45, openBefore: 20 },
    ]);
    expect(mapping.cutsIn({ start: 11, end: 29 })).toEqual([]);
  });

  it('meets the world at the origin whatever lies before it, so cuts left of nought count too', () => {
    const around = cutsMapping(numberDomain, [
      { from: -30, to: -20 },
      { from: -5, to: 5 },
    ]);

    expect(around.toVirtual(0)).toBe(0);
    expect(around.toVirtual(-5)).toBe(0);
    expect(around.toVirtual(5)).toBe(0);
    expect(around.toVirtual(-10)).toBe(-5);
    expect(around.toVirtual(-40)).toBe(-25);
    expect(around.toWorld(-25)).toBe(-40);
    expect(around.toWorld(-5)).toBe(-10);
    expect(around.toWorld(0)).toBe(5);
    expect(around.toWorld(0, 'before')).toBe(-5);
  });

  it('merges cuts that overlap or touch and drops empty ones', () => {
    const merged = cutsMapping(numberDomain, [
      { from: 30, to: 30 },
      { from: 10, to: 15 },
      { from: 15, to: 20 },
      { from: 12, to: 18 },
    ]);

    expect(merged.cutsIn({ start: 0, end: 100 })).toEqual([
      { at: 10, from: 10, to: 20, openBefore: undefined },
    ]);
    expect(merged.id).toBe(cutsMapping(numberDomain, [{ from: 10, to: 20 }]).id);
  });

  it('keeps nanoseconds exact over decades of time', () => {
    const YEAR = 31_557_600_000_000_000n;
    const domain = timeDomain();
    const decades = cutsMapping(domain, [{ from: 0n, to: 30n * YEAR }]);
    const moment = 40n * YEAR + 123n;

    expect(decades.toVirtual(moment)).toBe(10n * YEAR + 123n);
    expect(decades.toWorld(decades.toVirtual(moment))).toBe(moment);
  });
});
