export function replaceById<TItem extends { readonly id: string }>(
  items: readonly TItem[],
  id: string,
  updateItem: (item: TItem) => TItem
): readonly TItem[] {
  const index = items.findIndex(item => item.id === id);

  if (index < 0) {
    return items;
  }

  const next = [...items];
  next[index] = updateItem(next[index]);

  return next;
}

export function removeById<TItem extends { readonly id: string }>(
  items: readonly TItem[],
  id: string
): readonly TItem[] {
  const next = items.filter(item => item.id !== id);

  return next.length === items.length ? items : next;
}
