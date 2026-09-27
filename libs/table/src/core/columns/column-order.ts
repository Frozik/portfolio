/**
 * Where a column that is absent from the persisted order belongs: right after
 * its nearest preceding neighbour from the definition order, so a column that
 * appears late (from data, from a filter) lands where the author put it rather
 * than at the end.
 */
export function lateColumnIndex(
  definitionIds: readonly string[],
  orderedIds: readonly string[],
  columnId: string
): number {
  const definitionIndex = definitionIds.indexOf(columnId);
  if (definitionIndex === -1) {
    return orderedIds.length;
  }
  for (let index = definitionIndex - 1; index >= 0; index -= 1) {
    const neighbourIndex = orderedIds.indexOf(definitionIds[index]);
    if (neighbourIndex !== -1) {
      return neighbourIndex + 1;
    }
  }
  return 0;
}

/**
 * The persisted order with unknown ids dropped and late definition columns
 * inserted at their definition positions.
 */
export function mergeColumnOrder(
  definitionIds: readonly string[],
  persistedOrder: readonly string[] | undefined
): readonly string[] {
  if (persistedOrder === undefined) {
    return definitionIds;
  }
  const known = new Set(definitionIds);
  const merged = persistedOrder.filter(id => known.has(id));
  for (const id of definitionIds) {
    if (!merged.includes(id)) {
      merged.splice(lateColumnIndex(definitionIds, merged, id), 0, id);
    }
  }
  return merged;
}

export function moveWithin(
  order: readonly string[],
  columnId: string,
  toIndex: number
): readonly string[] {
  const fromIndex = order.indexOf(columnId);
  if (fromIndex === -1) {
    return order;
  }
  const next = order.filter(id => id !== columnId);
  const boundedIndex = Math.max(0, Math.min(toIndex, next.length));
  next.splice(boundedIndex, 0, columnId);
  return next;
}
