import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';
import {
  addTerm,
  moveTerm,
  removeTerm,
  reorderTerm,
  setTermOperation,
  ungroupTerm,
  updateShape,
  wrapTermInGroup,
} from './composition-edits';
import type { CsgOperand, Shape, ShapeComposition, ShapeGroup } from './shapes';
import {
  createCircle,
  createRectangle,
  createShapeId,
  findGroupTerm,
  findTerm,
  flattenShapes,
  isShapeGroup,
} from './shapes';

function createTestComposition(): ShapeComposition {
  return {
    terms: [
      {
        operand: createRectangle({
          center: { x: 15, y: 20 },
          width: 30,
          length: 40,
          rotationDegrees: 0,
        }),
        operation: 'union',
      },
      { operand: createCircle({ center: { x: 5, y: 5 }, radius: 3 }), operation: 'subtract' },
    ],
  };
}

/** The rectangle, then a group holding a circle cut out of another rectangle. */

/** The rectangle, then a group holding a circle cut out of another rectangle. */
function createNestedComposition(): ShapeComposition {
  const group: ShapeGroup = {
    kind: 'group',
    id: createShapeId(),
    terms: [
      {
        operand: createRectangle({
          center: { x: 40, y: 40 },
          width: 10,
          length: 10,
          rotationDegrees: 0,
        }),
        operation: 'union',
      },
      { operand: createCircle({ center: { x: 40, y: 40 }, radius: 2 }), operation: 'subtract' },
    ],
  };

  return { terms: [...createTestComposition().terms, { operand: group, operation: 'subtract' }] };
}

function nestedGroupOf(composition: ShapeComposition): ShapeGroup {
  const { operand } = composition.terms[2];

  if (!isShapeGroup(operand)) {
    throw new Error('the third term of the nested composition is expected to be a group');
  }

  return operand;
}

function leafShape(operand: CsgOperand): Shape {
  assert(!isShapeGroup(operand), 'expected a primitive shape operand');

  return operand;
}

describe('composition edits', () => {
  it('appends a term at the end', () => {
    const composition = createTestComposition();
    const term = {
      operand: createCircle({ center: { x: 9, y: 9 }, radius: 1 }),
      operation: 'union',
    } as const;

    const next = addTerm(composition, term);

    expect(next.terms).toHaveLength(3);
    expect(next.terms[2]).toBe(term);
    expect(composition.terms).toHaveLength(2);
  });

  it('replaces the shape of the matching term', () => {
    const composition = createTestComposition();
    const original = leafShape(composition.terms[0].operand);
    const resized = { ...original, width: 25 };

    const next = updateShape(composition, resized);

    expect(next.terms[0].operand).toEqual(resized);
    expect(next.terms[0].operation).toBe('union');
    expect(next.terms[1]).toBe(composition.terms[1]);
    expect(composition.terms[0].operand).toBe(original);
  });

  it('keeps the composition untouched when the shape is unknown', () => {
    const composition = createTestComposition();
    const foreign = createCircle({ center: { x: 0, y: 0 }, radius: 1 });

    expect(updateShape(composition, foreign)).toBe(composition);
    expect(setTermOperation(composition, foreign.id, 'union')).toBe(composition);
    expect(reorderTerm(composition, foreign.id, 0)).toBe(composition);
    expect(removeTerm(composition, foreign.id)).toBe(composition);
    expect(addTerm(composition, composition.terms[0], foreign.id)).toBe(composition);
    expect(wrapTermInGroup(composition, foreign.id, createShapeId())).toBe(composition);
    expect(ungroupTerm(composition, foreign.id)).toBe(composition);
  });

  it('switches the operation of a term', () => {
    const composition = createTestComposition();
    const circleId = composition.terms[1].operand.id;

    const next = setTermOperation(composition, circleId, 'union');

    expect(next.terms[1].operation).toBe('union');
    expect(next.terms[1].operand).toBe(composition.terms[1].operand);
    expect(composition.terms[1].operation).toBe('subtract');
  });

  it('moves a term to the requested position', () => {
    const composition = createTestComposition();
    const circleId = composition.terms[1].operand.id;

    const next = reorderTerm(composition, circleId, 0);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      circleId,
      composition.terms[0].operand.id,
    ]);
  });

  it('clamps a reorder target to the available range', () => {
    const composition = createTestComposition();
    const rectangleId = composition.terms[0].operand.id;

    const next = reorderTerm(composition, rectangleId, 10);

    expect(next.terms[1].operand.id).toBe(rectangleId);
  });

  it('drops the term of the removed shape', () => {
    const composition = createTestComposition();
    const rectangleId = composition.terms[0].operand.id;

    const next = removeTerm(composition, rectangleId);

    expect(next.terms).toHaveLength(1);
    expect(next.terms[0]).toBe(composition.terms[1]);
  });
});

describe('nested composition edits', () => {
  it('appends a term to the addressed group instead of the root', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const term = {
      operand: createCircle({ center: { x: 41, y: 41 }, radius: 1 }),
      operation: 'union',
    } as const;

    const next = addTerm(composition, term, group.id);

    expect(next.terms).toHaveLength(3);
    expect(nestedGroupOf(next).terms).toHaveLength(3);
    expect(nestedGroupOf(next).terms[2]).toBe(term);
    expect(group.terms).toHaveLength(2);
  });

  it('edits a leaf that sits inside a group', () => {
    const composition = createNestedComposition();
    const nested = leafShape(nestedGroupOf(composition).terms[0].operand);
    const resized = { ...nested, width: 12 };

    const next = updateShape(composition, resized);

    expect(nestedGroupOf(next).terms[0].operand).toEqual(resized);
    expect(next.terms[0]).toBe(composition.terms[0]);
  });

  it('switches, moves and drops a term inside a group', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const [firstTerm, secondTerm] = group.terms;

    expect(
      nestedGroupOf(setTermOperation(composition, secondTerm.operand.id, 'union')).terms[1]
    ).toMatchObject({ operation: 'union' });
    expect(
      nestedGroupOf(reorderTerm(composition, secondTerm.operand.id, 0)).terms.map(
        term => term.operand.id
      )
    ).toEqual([secondTerm.operand.id, firstTerm.operand.id]);
    expect(nestedGroupOf(removeTerm(composition, firstTerm.operand.id)).terms).toEqual([
      secondTerm,
    ]);
  });

  it('takes the whole subtree away with the group it removes', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = removeTerm(composition, group.id);

    expect(next.terms).toHaveLength(2);
    expect(findTerm(next, group.terms[0].operand.id)).toBeUndefined();
  });

  it('keeps a reorder confined to the term list that holds the term', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = reorderTerm(composition, group.terms[1].operand.id, 0);

    expect(next.terms.map(term => term.operand.id)).toEqual(
      composition.terms.map(term => term.operand.id)
    );
  });
});

describe('moveTerm', () => {
  it('takes a root term into the addressed group at the requested place', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const circleTerm = composition.terms[1];

    const next = moveTerm(composition, circleTerm.operand.id, group.id, 1);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      group.id,
    ]);
    expect(findGroupTerm(next, group.id)?.group.terms).toEqual([
      group.terms[0],
      circleTerm,
      group.terms[1],
    ]);
  });

  it('takes a nested term out to the root', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const innerCircleTerm = group.terms[1];

    const next = moveTerm(composition, innerCircleTerm.operand.id, undefined, 1);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      innerCircleTerm.operand.id,
      composition.terms[1].operand.id,
      group.id,
    ]);
    expect(next.terms[1].operation).toBe('subtract');
    expect(findGroupTerm(next, group.id)?.group.terms).toHaveLength(1);
  });

  it('counts the target place over the list as it stands before the move', () => {
    const composition = createNestedComposition();
    const [rectangleTerm, circleTerm] = composition.terms;

    const next = moveTerm(composition, rectangleTerm.operand.id, undefined, 2);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      circleTerm.operand.id,
      rectangleTerm.operand.id,
      nestedGroupOf(composition).id,
    ]);
  });

  it('clamps the target place into the list', () => {
    const composition = createNestedComposition();
    const rectangleTerm = composition.terms[0];

    const next = moveTerm(composition, rectangleTerm.operand.id, undefined, 10);

    expect(next.terms[2].operand.id).toBe(rectangleTerm.operand.id);
  });

  it('carries the whole subtree with the group it moves', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = moveTerm(composition, group.id, undefined, 0);

    expect(next.terms[0].operand).toBe(group);
    expect(flattenShapes(next)).toHaveLength(flattenShapes(composition).length);
  });

  it('refuses to move a group into itself', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    expect(moveTerm(composition, group.id, group.id, 0)).toBe(composition);
  });

  it('refuses to move a group into a group nested inside it', () => {
    const composition = createNestedComposition();
    const outerGroup = nestedGroupOf(composition);
    const innerGroupId = createShapeId();
    const nested = wrapTermInGroup(composition, outerGroup.terms[0].operand.id, innerGroupId);

    expect(moveTerm(nested, outerGroup.id, innerGroupId, 0)).toBe(nested);
  });

  it('keeps the composition for an unknown term or an unknown target', () => {
    const composition = createNestedComposition();
    const rectangleId = composition.terms[0].operand.id;
    const foreignId = createShapeId();

    expect(moveTerm(composition, foreignId, undefined, 0)).toBe(composition);
    expect(moveTerm(composition, rectangleId, foreignId, 0)).toBe(composition);
    // A leaf is not a container: dropping a term on a shape means nothing.
    expect(moveTerm(composition, rectangleId, composition.terms[1].operand.id, 0)).toBe(
      composition
    );
  });

  it('keeps the composition when the term is asked for the place it already holds', () => {
    const composition = createNestedComposition();
    const rectangleId = composition.terms[0].operand.id;

    expect(moveTerm(composition, rectangleId, undefined, 0)).toBe(composition);
    expect(moveTerm(composition, rectangleId, undefined, 1)).toBe(composition);
  });

  it('unions the term that lands first in its new list', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const circleTerm = composition.terms[1];

    const movedToRoot = moveTerm(composition, circleTerm.operand.id, undefined, 0);
    const movedIntoGroup = moveTerm(composition, circleTerm.operand.id, group.id, 0);

    expect(movedToRoot.terms[0]).toEqual({ operand: circleTerm.operand, operation: 'union' });
    expect(findGroupTerm(movedIntoGroup, group.id)?.group.terms[0]).toEqual({
      operand: circleTerm.operand,
      operation: 'union',
    });
  });

  it('unions the term left standing first by the one that moved away', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = moveTerm(composition, group.terms[0].operand.id, undefined, 3);

    expect(findGroupTerm(next, group.id)?.group.terms).toEqual([
      { operand: group.terms[1].operand, operation: 'union' },
    ]);
  });
});

describe('wrapTermInGroup', () => {
  it('replaces the term with a group holding it, under the given identity', () => {
    const composition = createTestComposition();
    const circleTerm = composition.terms[1];
    const groupId = createShapeId();

    const next = wrapTermInGroup(composition, circleTerm.operand.id, groupId);
    const wrapped = findGroupTerm(next, groupId);

    expect(next.terms).toHaveLength(2);
    expect(wrapped?.group.id).toBe(groupId);
    // The group joins the fold the way the term did, and the term is unioned
    // inside it, so the plan is drawn exactly as it was before.
    expect(wrapped?.operation).toBe('subtract');
    expect(wrapped?.group.terms).toEqual([{ operand: circleTerm.operand, operation: 'union' }]);
    expect(composition.terms[1]).toBe(circleTerm);
  });

  it('wraps a term that sits inside a group', () => {
    const composition = createNestedComposition();
    const innerTerm = nestedGroupOf(composition).terms[0];
    const groupId = createShapeId();

    const next = wrapTermInGroup(composition, innerTerm.operand.id, groupId);

    expect(nestedGroupOf(next).terms[0].operand.id).toBe(groupId);
    expect(flattenShapes(next)).toEqual(flattenShapes(composition));
  });
});

describe('ungroupTerm', () => {
  it('inlines the terms of the group in its place', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = ungroupTerm(composition, group.id);

    expect(next.terms).toHaveLength(4);
    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      composition.terms[1].operand.id,
      group.terms[0].operand.id,
      group.terms[1].operand.id,
    ]);
  });

  it("hands the group's operation to the first inlined term and leaves the rest alone", () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = ungroupTerm(composition, group.id);

    expect(next.terms[2].operation).toBe('subtract');
    expect(next.terms[3]).toBe(group.terms[1]);
  });

  it('undoes a wrap exactly', () => {
    const composition = createTestComposition();
    const groupId = createShapeId();

    const wrapped = wrapTermInGroup(composition, composition.terms[1].operand.id, groupId);

    expect(ungroupTerm(wrapped, groupId)).toEqual(composition);
  });

  it('drops an empty group, since it has nothing to inline', () => {
    const emptyGroup: ShapeGroup = { kind: 'group', id: createShapeId(), terms: [] };
    const composition: ShapeComposition = {
      terms: [...createTestComposition().terms, { operand: emptyGroup, operation: 'union' }],
    };

    expect(ungroupTerm(composition, emptyGroup.id).terms).toHaveLength(2);
  });

  it('refuses to ungroup a leaf', () => {
    const composition = createTestComposition();

    expect(ungroupTerm(composition, composition.terms[0].operand.id)).toBe(composition);
  });
});
