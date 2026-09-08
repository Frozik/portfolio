import { describe, expect, it } from 'vitest';

import { createBlock, createChamferedBlock, createWall } from './walls';

describe('createWall', () => {
  it('derives floor faces from axis-aligned edges and deflectors from diagonals', () => {
    const wall = createWall([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);

    expect(wall.edges.map(edge => edge.kind)).toEqual([
      'floor',
      'floor',
      'deflector',
      'floor',
      'floor',
    ]);
  });

  it('points every normal outward for counter-clockwise vertices', () => {
    const block = createBlock(0, 0, 2, 1);

    expect(block.edges.map(edge => edge.normal)).toEqual([
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]);
  });

  it('upgrades a named axis-aligned edge to a bounce face', () => {
    const block = createWall(createBlock(0, 0, 1, 1).vertices, new Set([2]));

    expect(block.edges[2].kind).toBe('bounce');
  });

  it('refuses clockwise vertices and slanted edges', () => {
    expect(() =>
      createWall([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ])
    ).toThrow(/counter-clockwise/);
    expect(() =>
      createWall([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 0, y: 2 },
      ])
    ).toThrow(/neither axis-aligned nor diagonal/);
  });
});

describe('createChamferedBlock', () => {
  it('cuts the named corners into deflectors and keeps the others sharp', () => {
    const block = createChamferedBlock(0, 0, 4, 2, 0.5, new Set(['upperLeft', 'lowerRight']));

    expect(block.vertices).toHaveLength(6);
    expect(block.edges.filter(edge => edge.kind === 'deflector')).toHaveLength(2);
    expect(block.vertices[0]).toEqual({ x: 0, y: 0 });
  });
});
