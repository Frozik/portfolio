import { describe, expect, it } from 'vitest';

import type { ShapeComposition, ShapeGroup } from './shapes';
import {
  collectGroupSubtreeIds,
  createCircle,
  createRectangle,
  createShapeId,
  findGroupTerm,
  findShape,
  findTerm,
  flattenShapes,
  isShapeGroup,
  shapesExcept,
  translateComposition,
} from './shapes';

describe('createShapeId', () => {
  it('mints a distinct id per call', () => {
    expect(createShapeId()).not.toBe(createShapeId());
  });
});

describe('createRectangle', () => {
  it('keeps the given parameters and tags the shape as a rectangle', () => {
    const rectangle = createRectangle({
      center: { x: 15, y: 20 },
      width: 30,
      length: 40,
      rotationDegrees: 15,
    });

    expect(rectangle.kind).toBe('rectangle');
    expect(rectangle.center).toEqual({ x: 15, y: 20 });
    expect(rectangle.width).toBe(30);
    expect(rectangle.length).toBe(40);
    expect(rectangle.rotationDegrees).toBe(15);
  });

  it('gives every rectangle its own id', () => {
    const parameters = {
      center: { x: 0, y: 0 },
      width: 1,
      length: 1,
      rotationDegrees: 0,
    };

    expect(createRectangle(parameters).id).not.toBe(createRectangle(parameters).id);
  });
});

describe('createCircle', () => {
  it('keeps the given parameters and tags the shape as a circle', () => {
    const circle = createCircle({ center: { x: 4, y: 6 }, radius: 3 });

    expect(circle.kind).toBe('circle');
    expect(circle.center).toEqual({ x: 4, y: 6 });
    expect(circle.radius).toBe(3);
  });

  it('gives every circle its own id', () => {
    const parameters = { center: { x: 0, y: 0 }, radius: 1 };

    expect(createCircle(parameters).id).not.toBe(createCircle(parameters).id);
  });
});

const plot = createRectangle({
  center: { x: 15, y: 20 },
  width: 30,
  length: 40,
  rotationDegrees: 0,
});
const pond = createCircle({ center: { x: 5, y: 5 }, radius: 3 });
const island = createCircle({ center: { x: 5, y: 5 }, radius: 1 });

/** The plot, then a group holding the pond and — one level deeper — its island. */
function createNestedComposition(): ShapeComposition {
  const innerGroup: ShapeGroup = {
    kind: 'group',
    id: createShapeId(),
    terms: [{ operand: island, operation: 'union' }],
  };
  const outerGroup: ShapeGroup = {
    kind: 'group',
    id: createShapeId(),
    terms: [
      { operand: pond, operation: 'union' },
      { operand: innerGroup, operation: 'subtract' },
    ],
  };

  return {
    terms: [
      { operand: plot, operation: 'union' },
      { operand: outerGroup, operation: 'subtract' },
    ],
  };
}

describe('isShapeGroup', () => {
  it('tells a nested composition apart from a primitive', () => {
    const composition = createNestedComposition();

    expect(isShapeGroup(composition.terms[0].operand)).toBe(false);
    expect(isShapeGroup(composition.terms[1].operand)).toBe(true);
  });
});

describe('flattenShapes', () => {
  it('reads every primitive of the tree, parents before their groups', () => {
    expect(flattenShapes(createNestedComposition())).toEqual([plot, pond, island]);
  });

  it('reads a group on its own as the shapes it holds', () => {
    const composition = createNestedComposition();
    const { operand } = composition.terms[1];

    expect(isShapeGroup(operand) ? flattenShapes(operand) : []).toEqual([pond, island]);
  });

  it('reads an empty composition as no shapes at all', () => {
    expect(flattenShapes({ terms: [] })).toEqual([]);
  });
});

describe('findTerm / findShape / findGroupTerm', () => {
  it('finds a leaf however deep it sits', () => {
    const composition = createNestedComposition();

    expect(findShape(composition, plot.id)).toBe(plot);
    expect(findShape(composition, island.id)).toBe(island);
    expect(findTerm(composition, island.id)?.operation).toBe('union');
  });

  it('finds a group with the operation it joins its parent fold with', () => {
    const composition = createNestedComposition();
    const groupId = composition.terms[1].operand.id;

    expect(findGroupTerm(composition, groupId)?.operation).toBe('subtract');
    expect(findGroupTerm(composition, groupId)?.group).toBe(composition.terms[1].operand);
  });

  it('refuses to read a group as a shape, or a shape as a group', () => {
    const composition = createNestedComposition();
    const groupId = composition.terms[1].operand.id;

    expect(findShape(composition, groupId)).toBeUndefined();
    expect(findGroupTerm(composition, plot.id)).toBeUndefined();
  });

  it('finds nothing for an id the tree does not hold', () => {
    const composition = createNestedComposition();
    const foreignId = createShapeId();

    expect(findTerm(composition, foreignId)).toBeUndefined();
    expect(findShape(composition, foreignId)).toBeUndefined();
    expect(findGroupTerm(composition, foreignId)).toBeUndefined();
  });
});

describe('collectGroupSubtreeIds', () => {
  it('reads the group itself together with every group nested in it', () => {
    const composition = createNestedComposition();
    const { operand } = composition.terms[1];
    const innerGroupId = isShapeGroup(operand) ? operand.terms[1].operand.id : undefined;

    expect(isShapeGroup(operand) ? collectGroupSubtreeIds(operand) : undefined).toEqual(
      new Set([operand.id, innerGroupId])
    );
  });

  it('reads a group with no groups in it as itself alone', () => {
    const group: ShapeGroup = {
      kind: 'group',
      id: createShapeId(),
      terms: [{ operand: pond, operation: 'union' }],
    };

    expect(collectGroupSubtreeIds(group)).toEqual(new Set([group.id]));
  });
});

describe('shapesExcept', () => {
  it('drops the named shape and keeps the rest in order', () => {
    expect(shapesExcept([plot, pond, island], pond.id)).toEqual([plot, island]);
  });
});

describe('translateComposition', () => {
  it('slides every leaf, groups included, and nothing else', () => {
    const composition = {
      terms: [
        {
          operand: createRectangle({
            center: { x: 2, y: 3 },
            width: 4,
            length: 4,
            rotationDegrees: 30,
          }),
          operation: 'union' as const,
        },
        {
          operand: {
            kind: 'group' as const,
            id: createShapeId(),
            terms: [
              {
                operand: createCircle({ center: { x: 10, y: 10 }, radius: 2 }),
                operation: 'union' as const,
              },
            ],
          },
          operation: 'subtract' as const,
        },
      ],
    };

    const moved = translateComposition(composition, { x: 5, y: -1 });
    const [first, second] = moved.terms;

    expect(first.operand).toMatchObject({ center: { x: 7, y: 2 }, rotationDegrees: 30 });
    expect(
      isShapeGroup(second.operand) ? second.operand.terms[0].operand : undefined
    ).toMatchObject({ center: { x: 15, y: 9 } });
  });
});
