import { describe, expect, it } from 'vitest';

import {
  createUtilityEntry,
  DEFAULT_FROST_DEPTH_METERS,
  defaultEntryDepth,
  ENTRY_SYSTEMS,
  entryKindFor,
} from './foundation';

describe('entryKindFor', () => {
  it('keeps gas on the facade and everything else in a sleeve', () => {
    expect(entryKindFor('gas')).toBe('facade');
    expect(entryKindFor('power')).toBe('sleeve');
    expect(entryKindFor('water')).toBe('sleeve');
    expect(entryKindFor('sewer')).toBe('sleeve');
    expect(entryKindFor('network')).toBe('sleeve');
  });
});

describe('defaultEntryDepth', () => {
  it('derives the water and sewer depths from the frost line', () => {
    expect(defaultEntryDepth('water', 1.5)).toBeCloseTo(2);
    expect(defaultEntryDepth('sewer', 1.5)).toBeCloseTo(1.8);
  });

  it('gives cables their standard cover and gas its facade height', () => {
    expect(defaultEntryDepth('power', 1.5)).toBeCloseTo(0.7);
    expect(defaultEntryDepth('network', 1.5)).toBeCloseTo(0.7);
    expect(defaultEntryDepth('gas', 1.5)).toBeCloseTo(0.5);
  });
});

describe('createUtilityEntry', () => {
  it('mints every entering system with its norm defaults', () => {
    for (const system of ENTRY_SYSTEMS) {
      const entry = createUtilityEntry({ system, outlineOffsetMeters: 3 });

      expect(entry.system).toBe(system);
      expect(entry.outlineOffsetMeters).toBe(3);
      expect(entry.kind).toBe(entryKindFor(system));
      expect(entry.depthMeters).toBe(defaultEntryDepth(system, DEFAULT_FROST_DEPTH_METERS));
    }
  });

  it('sizes the sewer sleeve a step over its pipe and gives gas none', () => {
    const sewer = createUtilityEntry({ system: 'sewer', outlineOffsetMeters: 0 });
    const gas = createUtilityEntry({ system: 'gas', outlineOffsetMeters: 0 });

    expect(sewer.sleeveDiameterMeters).toBeCloseTo(0.16);
    expect(gas.sleeveDiameterMeters).toBeUndefined();
  });
});
