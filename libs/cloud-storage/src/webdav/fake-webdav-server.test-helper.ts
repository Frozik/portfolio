import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { IWebDavAccount } from './webdav-transport';

interface IFakeFile {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly etag: string;
  readonly modifiedAt: Temporal.Instant;
}

export interface IFakeWebDavOptions {
  /** Honours `If-Match` / `If-None-Match` (Nextcloud, Apache); rclone and nginx do not. */
  readonly conditionalRequests?: boolean;
  /** `MOVE` respects `Overwrite: F`; a server that does not just replaces. */
  readonly moveReplace?: boolean;
  readonly etags?: boolean;
  /** The CORS preflight lists `If-Match` / `If-None-Match`; when not, the browser refuses such a request. */
  readonly corsAllowsConditions?: boolean;
  /** No CORS at all: every request fails as the browser would fail it. */
  readonly corsBlocked?: boolean;
  /** Weak ETags compared strongly: every `If-Match` fails, even the right one. */
  readonly refusesEveryIfMatch?: boolean;
}

export const FAKE_ACCOUNT: IWebDavAccount = {
  endpoint: 'https://dav.example.org/remote.php/dav/files/me/Vaults/',
  username: 'me',
  password: 'app-pässword',
};

const ROOT_PATH = '/remote.php/dav/files/me/Vaults/';
const START = Temporal.Instant.from('2026-10-11T10:00:00Z');
const NAMESPACE_PREFIX = 'a';

function status(code: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: code, headers });
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function httpDate(instant: Temporal.Instant): string {
  const utc = instant.toZonedDateTimeISO('UTC');
  const two = (value: number) => String(value).padStart(2, '0');
  return `${DAYS[utc.dayOfWeek - 1]}, ${two(utc.day)} ${MONTHS[utc.month - 1]} ${utc.year} ${two(utc.hour)}:${two(utc.minute)}:${two(utc.second)} GMT`;
}

/**
 * A WebDAV server as `fetch` sees it, to the RFC 4918 subset the provider
 * uses, with the variations real servers differ in. Every write is a second
 * later than the one before, so modification times tell versions apart.
 */
export function createFakeWebDavServer({
  conditionalRequests = true,
  moveReplace = true,
  etags = true,
  corsAllowsConditions = true,
  corsBlocked = false,
  refusesEveryIfMatch = false,
}: IFakeWebDavOptions = {}) {
  const files = new Map<string, IFakeFile>();
  const folders = new Set<string>(['']);
  let clock = START;
  let etagCounter = 0;
  const authorization = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${FAKE_ACCOUNT.username}:${FAKE_ACCOUNT.password}`)))}`;

  const pathOf = (url: string): string => {
    const pathname = decodeURIComponent(new URL(url).pathname);
    assert(pathname.startsWith(ROOT_PATH) || `${pathname}/` === ROOT_PATH);
    return pathname.slice(ROOT_PATH.length).replace(/\/$/, '');
  };
  const parentOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0));
  const store = (path: string, bytes: Uint8Array<ArrayBuffer>, at = clock): IFakeFile => {
    clock = clock.add({ seconds: 1 });
    etagCounter += 1;
    const file = { bytes: bytes.slice(), etag: `"e${etagCounter}"`, modifiedAt: at };
    files.set(path, file);
    return file;
  };
  const failsPrecondition = (headers: Headers, current: IFakeFile | undefined): boolean => {
    if (!conditionalRequests) {
      return false;
    }
    const ifMatch = headers.get('If-Match');
    if (headers.get('If-None-Match') === '*' && !isNil(current)) {
      return true;
    }
    return !isNil(ifMatch) && (refusesEveryIfMatch || current?.etag !== ifMatch);
  };
  const propXml = (path: string, file: IFakeFile | null): string => {
    const prefix = NAMESPACE_PREFIX;
    const href = `${ROOT_PATH}${path.split('/').map(encodeURIComponent).join('/')}${isNil(file) && path !== '' ? '/' : ''}`;
    const props = isNil(file)
      ? `<${prefix}:resourcetype><${prefix}:collection/></${prefix}:resourcetype>`
      : `<${prefix}:resourcetype/><${prefix}:getcontentlength>${file.bytes.length}</${prefix}:getcontentlength>` +
        `<${prefix}:getlastmodified>${httpDate(file.modifiedAt)}</${prefix}:getlastmodified>` +
        (etags ? `<${prefix}:getetag>${file.etag}</${prefix}:getetag>` : '');
    return (
      `<${prefix}:response><${prefix}:href>${href}</${prefix}:href><${prefix}:propstat>` +
      `<${prefix}:prop>${props}</${prefix}:prop><${prefix}:status>HTTP/1.1 200 OK</${prefix}:status>` +
      `</${prefix}:propstat></${prefix}:response>`
    );
  };
  const propfind = (path: string, depth: string | null): Response => {
    const file = files.get(path);
    if (isNil(file) && !folders.has(path)) {
      return status(404);
    }
    const children =
      depth === '1' && isNil(file)
        ? [...folders, ...files.keys()].filter(
            candidate => candidate !== path && parentOf(candidate) === path
          )
        : [];
    const responses = [path, ...children]
      .map(entry => propXml(entry, files.get(entry) ?? null))
      .join('');
    return new Response(
      `<?xml version="1.0"?><${NAMESPACE_PREFIX}:multistatus xmlns:${NAMESPACE_PREFIX}="DAV:">${responses}</${NAMESPACE_PREFIX}:multistatus>`,
      { status: 207 }
    );
  };
  const handle = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (headers.get('Authorization') !== authorization) {
      return status(401);
    }
    const path = pathOf(url);
    const current = files.get(path);
    switch (init.method) {
      case 'PROPFIND':
        return propfind(path, headers.get('Depth'));
      case 'GET':
        if (isNil(current)) {
          return status(404);
        }
        if (failsPrecondition(headers, current)) {
          return status(412);
        }
        return new Response(current.bytes.slice(), { status: 200 });
      case 'PUT': {
        if (!folders.has(parentOf(path))) {
          return status(409);
        }
        if (failsPrecondition(headers, current)) {
          return status(412);
        }
        const body = new Uint8Array(await new Response(init.body).arrayBuffer());
        store(path, body);
        return status(isNil(current) ? 201 : 204);
      }
      case 'DELETE':
        if (isNil(current)) {
          return status(404);
        }
        if (failsPrecondition(headers, current)) {
          return status(412);
        }
        files.delete(path);
        return status(204);
      case 'MKCOL':
        if (folders.has(path) || files.has(path)) {
          return status(405);
        }
        if (!folders.has(parentOf(path))) {
          return status(409);
        }
        folders.add(path);
        return status(201);
      case 'MOVE': {
        const destination = pathOf(headers.get('Destination') ?? '');
        if (isNil(current)) {
          return status(404);
        }
        if (moveReplace && headers.get('Overwrite') === 'F' && files.has(destination)) {
          return status(412);
        }
        files.delete(path);
        store(destination, current.bytes);
        return status(201);
      }
      default:
        return status(405);
    }
  };

  const fetchFake: typeof fetch = async (input, init = {}) => {
    if (init.signal?.aborted === true) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const headers = new Headers(init.headers);
    const conditional = headers.has('If-Match') || headers.has('If-None-Match');
    if (corsBlocked || (conditional && !corsAllowsConditions)) {
      throw new TypeError('Failed to fetch');
    }
    return handle(String(input), init);
  };

  return {
    fetch: fetchFake,
    paths: () => [...files.keys()].sort(),
    /** Another writer, or a temporary file a cut-short write left at `at`. */
    putDirectly: (path: string, bytes: Uint8Array<ArrayBuffer>, at?: Temporal.Instant) => {
      folders.add(parentOf(path));
      store(path, bytes, at);
    },
  };
}
