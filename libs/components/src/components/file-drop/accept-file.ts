/**
 * Whether a file matches an `accept` list as the file
 * input reads it (`.pdf`, `image/*`, `application/pdf`); a drop or a paste
 * bypasses the input, so the same rule is applied by hand.
 */
export function acceptsFile(
  file: { readonly name: string; readonly type: string },
  accept: string | undefined
): boolean {
  const rules = (accept ?? '')
    .split(',')
    .map(rule => rule.trim().toLowerCase())
    .filter(rule => rule.length > 0);
  if (rules.length === 0) {
    return true;
  }
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some(rule => {
    if (rule.startsWith('.')) {
      return name.endsWith(rule);
    }
    if (rule.endsWith('/*')) {
      return type.startsWith(rule.slice(0, -1));
    }
    return type === rule;
  });
}
