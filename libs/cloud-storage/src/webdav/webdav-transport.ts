import { err, ok } from '@frozik/utils/result/result';

import { unansweredFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type { TStoragePath } from '../core/storage-provider';

export interface IWebDavAccount {
  /** The folder the vault lives in; every storage path is relative to it. */
  readonly endpoint: string;
  readonly username: string;
  /** An app password, never the account's own. */
  readonly password: string;
}

export interface IWebDavRequest {
  readonly method: 'PROPFIND' | 'GET' | 'PUT' | 'DELETE' | 'MKCOL' | 'MOVE';
  readonly path: TStoragePath;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
  readonly asFolder?: boolean;
}

export interface IWebDavTransport {
  send(request: IWebDavRequest, signal: AbortSignal): Promise<TStorageResult<Response>>;
  bytesOf(
    response: Response,
    signal: AbortSignal
  ): Promise<TStorageResult<Uint8Array<ArrayBuffer>>>;
  urlOf(path: TStoragePath, asFolder?: boolean): string;
  /** The storage path an `href` of a PROPFIND answer names, or `null` outside the endpoint. */
  pathOf(href: string): TStoragePath | null;
}

const SEPARATOR = '/';

/** A bare `%` a server or user wrote makes `decodeURIComponent` throw; such a path names nothing here. */
function decodedOrNull(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function basicAuthorization(username: string, password: string): string {
  const utf8 = new TextEncoder().encode(`${username}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...utf8))}`;
}

export function createWebDavTransport(
  { endpoint, username, password }: IWebDavAccount,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): IWebDavTransport {
  const root = new URL(endpoint.endsWith(SEPARATOR) ? endpoint : endpoint + SEPARATOR);
  const rootPath = decodedOrNull(root.pathname) ?? root.pathname;
  const authorization = basicAuthorization(username, password);

  const urlOf = (path: TStoragePath, asFolder = false): string => {
    const encoded = path.split(SEPARATOR).map(encodeURIComponent).join(SEPARATOR);
    const folderSuffix = asFolder && path !== '' ? SEPARATOR : '';
    return new URL(encoded + folderSuffix, root).href;
  };

  return {
    urlOf,
    pathOf: href => {
      const absolute = decodedOrNull(new URL(href, root).pathname);
      if (absolute === null) {
        return null;
      }
      if (!absolute.startsWith(rootPath) && `${absolute}${SEPARATOR}` !== rootPath) {
        return null;
      }
      const relative = absolute.slice(rootPath.length);
      return (relative.endsWith(SEPARATOR) ? relative.slice(0, -1) : relative) as TStoragePath;
    },
    send: async ({ method, path, headers, body, asFolder }, signal) => {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      try {
        const response = await fetchImpl(urlOf(path, asFolder), {
          method,
          headers: { Authorization: authorization, ...headers },
          body,
          signal,
          cache: 'no-store',
          credentials: 'omit',
        });
        return ok(response);
      } catch {
        return err(unansweredFailureOf(signal));
      }
    },
    bytesOf: async (response, signal) => {
      try {
        return ok(new Uint8Array(await response.arrayBuffer()));
      } catch {
        return err(unansweredFailureOf(signal));
      }
    },
  };
}
