/** Code-unit order: the same on every device, unlike `localeCompare`. */
export function compareStrings(first: string, second: string): number {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}
