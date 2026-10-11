/** The list operations of `ListEditor`, as pure functions over a readonly list. */
export function moveItem<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, ...(moved === undefined ? [] : [moved]));
  return result;
}

export function removeItem<T>(items: readonly T[], index: number): readonly T[] {
  return index < 0 || index >= items.length
    ? items
    : [...items.slice(0, index), ...items.slice(index + 1)];
}

export function replaceItem<T>(items: readonly T[], index: number, item: T): readonly T[] {
  return index < 0 || index >= items.length
    ? items
    : items.map((current, position) => (position === index ? item : current));
}
