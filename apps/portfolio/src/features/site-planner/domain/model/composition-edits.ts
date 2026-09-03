import { clamp, isNil } from 'lodash-es';
import type { CsgOperation, CsgTerm, Shape, ShapeComposition, ShapeGroup, ShapeId } from './shapes';
import { findGroupTerm, findTerm, isShapeGroup } from './shapes';

/**
 * Pure `(section, arguments) => section` edits over the plan sections. An edit
 * addressing an unknown id is a no-op that returns the very same section
 * reference, so the `observable.ref` sections in the store stay untouched and
 * no derived computation is invalidated.
 */

/**
 * Appends a term to the addressed group, or to the root when no group is named.
 * Every other term edit finds its target by the operand's own id: ids are minted
 * per operand and unique across the whole tree, so a caller holding one never
 * has to carry the path down to it as well.
 */
export function addTerm(
  composition: ShapeComposition,
  term: CsgTerm,
  groupId?: ShapeId
): ShapeComposition {
  if (isNil(groupId)) {
    return { terms: [...composition.terms, term] };
  }

  return withTerms(
    composition,
    editOwningTerms(composition.terms, groupId, (terms, index) =>
      replaceGroupTerms(terms, index, groupTerms => [...groupTerms, term])
    )
  );
}

export function updateShape(composition: ShapeComposition, shape: Shape): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, shape.id, (terms, index) =>
      replaceAt(terms, index, term => ({ ...term, operand: shape }))
    )
  );
}

export function setTermOperation(
  composition: ShapeComposition,
  operandId: ShapeId,
  operation: CsgOperation
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      replaceAt(terms, index, term => ({ ...term, operation }))
    )
  );
}

/** Moves a term within the term list that holds it; siblings elsewhere stay put. */
export function reorderTerm(
  composition: ShapeComposition,
  operandId: ShapeId,
  targetIndex: number
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, sourceIndex) => {
      const boundedIndex = clamp(targetIndex, 0, terms.length - 1);

      if (boundedIndex === sourceIndex) {
        return terms;
      }

      const next = [...terms];
      const [movedTerm] = next.splice(sourceIndex, 1);

      next.splice(boundedIndex, 0, movedTerm);

      return next;
    })
  );
}

/**
 * Takes the term out of the list that holds it and puts it into the addressed
 * group — the root of the composition when no group is named — at
 * `targetIndex`, counted over that group's terms as they stand before the move.
 * A group moved into itself or into one of its own descendants would take the
 * target out of the tree with it, so such a move is refused, as is one that
 * would leave the term exactly where it already stands.
 *
 * The term keeps the operation it joined its previous fold with, save at either
 * end of the move: a fold starts from nothing, so a leading subtraction would
 * fold the whole list away (`evaluate-composition.ts`). Whichever term ends up
 * first — the moved one, or the one it leaves behind — is therefore unioned.
 */
export function moveTerm(
  composition: ShapeComposition,
  operandId: ShapeId,
  targetGroupId: ShapeId | undefined,
  targetIndex: number
): ShapeComposition {
  const source = locateTerm(composition.terms, operandId, undefined);
  const targetTerms = resolveTargetTerms(composition, targetGroupId);

  if (isNil(source) || isNil(targetTerms) || entersOwnSubtree(source.term, targetGroupId)) {
    return composition;
  }

  const insertionIndex = resolveInsertionIndex({
    source,
    targetGroupId,
    targetTermCount: targetTerms.length,
    targetIndex,
  });

  if (isNil(insertionIndex)) {
    return composition;
  }

  return insertTerm({
    composition: detachTerm(composition, operandId),
    targetGroupId,
    index: insertionIndex,
    term: source.term,
  });
}

/** Drops the term; removing a group takes everything nested under it with it. */
export function removeTerm(composition: ShapeComposition, operandId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      terms.filter((_, candidateIndex) => candidateIndex !== index)
    )
  );
}

/**
 * Puts a term inside a group of its own, in its place. The group joins the
 * parent fold the way the term did, and the term becomes the group's first —
 * therefore unioned — member, so the plan draws exactly as it did before. The
 * identity of the group is given rather than minted here: the caller needs it to
 * point the selection at what it has just created, and an edit that reached no
 * term must not consume an id.
 */
export function wrapTermInGroup(
  composition: ShapeComposition,
  operandId: ShapeId,
  groupId: ShapeId
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) => {
      const { operand, operation } = terms[index];
      const group: ShapeGroup = {
        kind: 'group',
        id: groupId,
        terms: [{ operand, operation: 'union' }],
      };

      return replaceAt(terms, index, () => ({ operand: group, operation }));
    })
  );
}

/**
 * Inlines the terms of a group in its place. The group's own operation moves to
 * the first inlined term and the rest keep theirs, which is the only reading
 * that leaves a single-term group untouched — ungrouping a fold of several terms
 * can change the result, since a nested fold is not the same as a flat one.
 */
export function ungroupTerm(composition: ShapeComposition, groupId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, groupId, (terms, index) => {
      const { operand, operation } = terms[index];

      if (!isShapeGroup(operand)) {
        return terms;
      }

      const inlined = operand.terms.map((term, termIndex) =>
        termIndex === 0 ? { ...term, operation } : term
      );

      return [...terms.slice(0, index), ...inlined, ...terms.slice(index + 1)];
    })
  );
}

function withTerms(composition: ShapeComposition, terms: readonly CsgTerm[]): ShapeComposition {
  return terms === composition.terms ? composition : { terms };
}

/** Where a term stands: the list that holds it, and its place in that list. */
interface TermLocation {
  readonly term: CsgTerm;
  /** The group whose terms hold it; nothing when the root composition does. */
  readonly parentGroupId: ShapeId | undefined;
  readonly index: number;
}

function locateTerm(
  terms: readonly CsgTerm[],
  operandId: ShapeId,
  parentGroupId: ShapeId | undefined
): TermLocation | undefined {
  const index = terms.findIndex(term => term.operand.id === operandId);

  if (index >= 0) {
    return { term: terms[index], parentGroupId, index };
  }

  for (const { operand } of terms) {
    if (!isShapeGroup(operand)) {
      continue;
    }

    const nested = locateTerm(operand.terms, operandId, operand.id);

    if (!isNil(nested)) {
      return nested;
    }
  }

  return undefined;
}

/** The terms a move lands among, or nothing when the named group is not one. */
function resolveTargetTerms(
  composition: ShapeComposition,
  targetGroupId: ShapeId | undefined
): readonly CsgTerm[] | undefined {
  return isNil(targetGroupId)
    ? composition.terms
    : findGroupTerm(composition, targetGroupId)?.group.terms;
}

function entersOwnSubtree(term: CsgTerm, targetGroupId: ShapeId | undefined): boolean {
  const { operand } = term;

  if (isNil(targetGroupId)) {
    return false;
  }

  return (
    operand.id === targetGroupId ||
    (isShapeGroup(operand) && !isNil(findTerm(operand, targetGroupId)))
  );
}

/** Where the term is put back, or nothing when that is where it already stands. */
function resolveInsertionIndex({
  source,
  targetGroupId,
  targetTermCount,
  targetIndex,
}: {
  readonly source: TermLocation;
  readonly targetGroupId: ShapeId | undefined;
  readonly targetTermCount: number;
  readonly targetIndex: number;
}): number | undefined {
  const boundedIndex = clamp(targetIndex, 0, targetTermCount);

  if (source.parentGroupId !== targetGroupId) {
    return boundedIndex;
  }

  // The term leaves the list before it re-enters it, so every place past the one
  // it stands in moves one closer.
  const shiftedIndex = boundedIndex > source.index ? boundedIndex - 1 : boundedIndex;

  return shiftedIndex === source.index ? undefined : shiftedIndex;
}

function detachTerm(composition: ShapeComposition, operandId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      unionLeadingTerm(terms.filter((_, candidateIndex) => candidateIndex !== index))
    )
  );
}

function insertTerm({
  composition,
  targetGroupId,
  index,
  term,
}: {
  readonly composition: ShapeComposition;
  readonly targetGroupId: ShapeId | undefined;
  readonly index: number;
  readonly term: CsgTerm;
}): ShapeComposition {
  if (isNil(targetGroupId)) {
    return { terms: insertTermAt(composition.terms, index, term) };
  }

  return withTerms(
    composition,
    editOwningTerms(composition.terms, targetGroupId, (terms, groupIndex) =>
      replaceGroupTerms(terms, groupIndex, groupTerms => insertTermAt(groupTerms, index, term))
    )
  );
}

function insertTermAt(terms: readonly CsgTerm[], index: number, term: CsgTerm): readonly CsgTerm[] {
  const next = [...terms];

  next.splice(index, 0, term);

  return unionLeadingTerm(next);
}

/** The first term is what the rest is folded onto, so it can only be a union. */
function unionLeadingTerm(terms: readonly CsgTerm[]): readonly CsgTerm[] {
  if (terms.length === 0 || terms[0].operation === 'union') {
    return terms;
  }

  return replaceAt(terms, 0, term => ({ ...term, operation: 'union' }));
}

/**
 * Rewrites the term list that directly holds the operand, wherever in the tree
 * that list is, and rebuilds only the groups on the way down to it. An edit that
 * finds nothing — or changes nothing — hands back the very same list, so the
 * no-op reaches the caller as an unchanged composition reference.
 */
function editOwningTerms(
  terms: readonly CsgTerm[],
  operandId: ShapeId,
  edit: (terms: readonly CsgTerm[], index: number) => readonly CsgTerm[]
): readonly CsgTerm[] {
  const index = terms.findIndex(term => term.operand.id === operandId);

  if (index >= 0) {
    return edit(terms, index);
  }

  for (let groupIndex = 0; groupIndex < terms.length; groupIndex += 1) {
    const { operand } = terms[groupIndex];

    if (!isShapeGroup(operand)) {
      continue;
    }

    const nestedTerms = editOwningTerms(operand.terms, operandId, edit);

    if (nestedTerms !== operand.terms) {
      return replaceGroupTerms(terms, groupIndex, () => nestedTerms);
    }
  }

  return terms;
}

/** Rewrites the terms of the group standing at `index`; a leaf there is left alone. */
function replaceGroupTerms(
  terms: readonly CsgTerm[],
  index: number,
  updateTerms: (groupTerms: readonly CsgTerm[]) => readonly CsgTerm[]
): readonly CsgTerm[] {
  const { operand } = terms[index];

  if (!isShapeGroup(operand)) {
    return terms;
  }

  return replaceAt(terms, index, term => ({
    ...term,
    operand: { ...operand, terms: updateTerms(operand.terms) },
  }));
}

function replaceAt(
  terms: readonly CsgTerm[],
  index: number,
  updateTerm: (term: CsgTerm) => CsgTerm
): readonly CsgTerm[] {
  const next = [...terms];

  next[index] = updateTerm(next[index]);

  return next;
}
