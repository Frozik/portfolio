import { describe, expect, it } from 'vitest';

import {
  changeTreeSpecies,
  createTree,
  TREE_SPECIES,
  TREE_SPECIES_DEFAULT_SIZES,
} from './plot-objects';

describe('TREE_SPECIES_DEFAULT_SIZES', () => {
  it('gives every species a positive size of its own', () => {
    for (const species of TREE_SPECIES) {
      const size = TREE_SPECIES_DEFAULT_SIZES[species];

      expect(size.crownRadius).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(size.crownRadius);
    }
  });

  it('keeps the thuja a hedge column, well under the conifers', () => {
    const { thuja, spruce, pine } = TREE_SPECIES_DEFAULT_SIZES;

    expect(thuja.height).toBeLessThan(spruce.height / 2);
    expect(thuja.height).toBeLessThan(pine.height / 2);
    expect(thuja.crownRadius).toBeLessThan(spruce.crownRadius / 2);
  });
});

describe('changeTreeSpecies', () => {
  it('re-sizes a tree still wearing its species default', () => {
    const spruce = createTree({
      species: 'spruce',
      position: { x: 3, y: 4 },
      ...TREE_SPECIES_DEFAULT_SIZES.spruce,
    });

    const thuja = changeTreeSpecies(spruce, 'thuja');

    expect(thuja.species).toBe('thuja');
    expect(thuja.crownRadius).toBe(TREE_SPECIES_DEFAULT_SIZES.thuja.crownRadius);
    expect(thuja.height).toBe(TREE_SPECIES_DEFAULT_SIZES.thuja.height);
    expect(thuja.position).toEqual({ x: 3, y: 4 });
    expect(thuja.id).toBe(spruce.id);
  });

  it('keeps a size the user typed by hand', () => {
    const measured = createTree({
      species: 'spruce',
      position: { x: 0, y: 0 },
      crownRadius: 3.2,
      height: 14,
    });

    const relabeled = changeTreeSpecies(measured, 'deciduous');

    expect(relabeled.species).toBe('deciduous');
    expect(relabeled.crownRadius).toBe(3.2);
    expect(relabeled.height).toBe(14);
  });

  it('keeps a partially edited size too — half a measurement is still a measurement', () => {
    const trimmed = createTree({
      species: 'pine',
      position: { x: 0, y: 0 },
      crownRadius: TREE_SPECIES_DEFAULT_SIZES.pine.crownRadius,
      height: 9,
    });

    const relabeled = changeTreeSpecies(trimmed, 'spruce');

    expect(relabeled.crownRadius).toBe(TREE_SPECIES_DEFAULT_SIZES.pine.crownRadius);
    expect(relabeled.height).toBe(9);
  });
});
