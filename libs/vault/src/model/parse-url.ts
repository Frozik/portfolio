/** `URL.parse` without it: Safari before 18 does not have the static method. */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
