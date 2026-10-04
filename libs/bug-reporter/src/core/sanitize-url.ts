/** Origin and path only: a query string or fragment is where tokens and signed parameters travel. */
export function sanitizeUrl(url: string, base: string): string {
  try {
    const parsed = new URL(url, base);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split(/[?#]/, 1)[0] ?? url;
  }
}
