export type TWebDavAddressProblem = 'empty' | 'invalid' | 'insecure';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A bare `%` in the path cannot be read back from the server's answers. */
function isDecodable(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}

/**
 * The folder's address, over HTTPS only: Basic authorization
 * sends the app password with every request. Plain HTTP passes for this
 * machine alone (a server tried locally), the one exception browsers make too.
 */
export function webDavAddressProblem(text: string): TWebDavAddressProblem | null {
  if (text.trim() === '') {
    return 'empty';
  }
  const url = URL.parse(text.trim());
  if (
    url === null ||
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    !isDecodable(url.pathname)
  ) {
    return 'invalid';
  }
  return url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname) ? 'insecure' : null;
}
