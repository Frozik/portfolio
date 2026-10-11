import { err, ok } from '@frozik/utils/result/result';

import { httpFailureOf } from '../core/http-failure';
import type { TStorageResult } from '../core/storage-error';
import type { TStoragePath } from '../core/storage-provider';
import type { IWebDavTransport } from './webdav-transport';

const SEPARATOR = '/';
const HTTP_CONFLICT = 409;
const HTTP_METHOD_NOT_ALLOWED = 405;

export function parentOf(path: TStoragePath): TStoragePath {
  return path.slice(0, Math.max(path.lastIndexOf(SEPARATOR), 0)) as TStoragePath;
}

export function nameOf(path: TStoragePath): string {
  return path.slice(path.lastIndexOf(SEPARATOR) + 1);
}

export function siblingOf(path: TStoragePath, name: string): TStoragePath {
  const parent = parentOf(path);
  return (parent === '' ? name : `${parent}${SEPARATOR}${name}`) as TStoragePath;
}

/** RFC 4918 §9.7.1 — `MKCOL` each missing folder from the top; 405 means it is already there. */
async function createFolders(
  transport: IWebDavTransport,
  folder: TStoragePath,
  signal: AbortSignal
): Promise<TStorageResult<void>> {
  const segments = folder.split(SEPARATOR).filter(segment => segment !== '');
  for (let depth = 1; depth <= segments.length; depth += 1) {
    const sent = await transport.send(
      {
        method: 'MKCOL',
        path: segments.slice(0, depth).join(SEPARATOR) as TStoragePath,
        asFolder: true,
      },
      signal
    );
    if (!sent.ok) {
      return sent;
    }
    if (!sent.value.ok && sent.value.status !== HTTP_METHOD_NOT_ALLOWED) {
      return err(httpFailureOf(sent.value));
    }
  }
  return ok(undefined);
}

/** RFC 4918 §9.7.1 — a PUT into a missing folder is a 409: create the folders and try once more. */
export async function putCreatingFolders(
  transport: IWebDavTransport,
  path: TStoragePath,
  bytes: Uint8Array<ArrayBuffer>,
  headers: Readonly<Record<string, string>>,
  signal: AbortSignal
): Promise<TStorageResult<Response>> {
  const put = () => transport.send({ method: 'PUT', path, headers, body: bytes }, signal);
  const first = await put();
  if (!first.ok || first.value.status !== HTTP_CONFLICT) {
    return first;
  }
  const created = await createFolders(transport, parentOf(path), signal);
  return created.ok ? put() : created;
}
