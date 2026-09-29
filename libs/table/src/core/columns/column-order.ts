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

/**
 * Moves a column to a slot among `slots`: the columns it can be dropped
 * between (the visible ones of its section, itself excluded, in order). Every
 * other column — hidden, or pinned elsewhere — keeps its place next to its
 * neighbours. A slot past the end lands after the last of them; a column
 * alone in its section has nowhere to go and stays.
 */
export function moveToSlot(
  order: readonly string[],
  columnId: string,
  slots: readonly string[],
  toIndex: number
): readonly string[] {
  if (!order.includes(columnId) || slots.length === 0) {
    return order;
  }
  const without = order.filter(id => id !== columnId);
  const bounded = Math.max(0, Math.min(toIndex, slots.length));
  const before = slots[bounded];
  const last = slots.at(-1);
  const insertAt =
    before !== undefined
      ? without.indexOf(before)
      : last === undefined
        ? without.length
        : without.indexOf(last) + 1;
  return [...without.slice(0, insertAt), columnId, ...without.slice(insertAt)];
}
