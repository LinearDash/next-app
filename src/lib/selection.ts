export function toggleSelection<T>(items: readonly T[], item: T, selected: boolean): T[] {
  if (selected) return items.includes(item) ? [...items] : [...items, item];
  return items.filter((current) => current !== item);
}
