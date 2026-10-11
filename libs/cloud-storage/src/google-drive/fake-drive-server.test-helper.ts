import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { ok } from '@frozik/utils/result/result';

import type { IAccessTokenSource } from './access-token';

interface IFakeDriveFile {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
  readonly isFolder: boolean;
  readonly createdAt: Temporal.Instant;
  readonly space: 'drive' | 'appDataFolder';
  modifiedAt: Temporal.Instant;
  headRevisionId: string | null;
  trashed: boolean;
}

export const FAKE_TOKEN = 'fake-access-token';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const START = Temporal.Instant.from('2026-10-11T10:00:00Z');
const QUOTED = String.raw`'((?:[^'\\]|\\.)*)'`;
const PARENT_CLAUSE = new RegExp(`${QUOTED} in parents`);
const NAME_CLAUSE = new RegExp(`name = ${QUOTED}`);

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function driveError(status: number, reason: string): Response {
  return json({ error: { code: status, errors: [{ reason }] } }, status);
}

function unescaped(value: string): string {
  return value.replace(/\\(.)/g, '$1');
}

export function fakeTokenSource(): IAccessTokenSource & { readonly invalidated: () => number } {
  let invalidated = 0;
  return {
    token: () => Promise.resolve(ok(FAKE_TOKEN)),
    invalidate: () => {
      invalidated += 1;
    },
    invalidated: () => invalidated,
  };
}

/**
 * Drive v3 as `fetch` sees it, to the subset the provider calls: listing by
 * parent and name, folder creation, resumable uploads, revision-pinned
 * reads, deletion, and the two spaces kept apart. Every change is a second
 * later than the one before; revision ids never repeat.
 */
export function createFakeDriveServer() {
  const files = new Map<string, IFakeDriveFile>();
  const revisions = new Map<string, Uint8Array<ArrayBuffer>>();
  const uploads = new Map<string, { readonly fileId: string | null; readonly metadata: unknown }>();
  let clock = START;
  let counter = 0;
  let nextFailure: Response | null = null;
  let beforeNextUpload: (() => void) | null = null;

  const nextId = (prefix: string) => {
    counter += 1;
    return `${prefix}${counter}`;
  };
  const tick = () => {
    clock = clock.add({ seconds: 1 });
    return clock;
  };
  const spaceOf = (parentId: string): IFakeDriveFile['space'] =>
    parentId === 'appDataFolder' ? 'appDataFolder' : (files.get(parentId)?.space ?? 'drive');
  const resource = (file: IFakeDriveFile) => ({
    id: file.id,
    name: file.name,
    mimeType: file.isFolder ? FOLDER_MIME : 'application/octet-stream',
    ...(file.isFolder ? {} : { headRevisionId: file.headRevisionId }),
    ...(file.isFolder
      ? {}
      : { size: String(revisions.get(file.headRevisionId ?? '')?.length ?? 0) }),
    modifiedTime: file.modifiedAt.toString(),
    createdTime: file.createdAt.toString(),
    trashed: file.trashed,
  });
  const store = (fileId: string, bytes: Uint8Array<ArrayBuffer>) => {
    const file = files.get(fileId);
    if (isNil(file)) {
      return;
    }
    const revisionId = nextId('r');
    revisions.set(revisionId, bytes.slice());
    file.headRevisionId = revisionId;
    file.modifiedAt = tick();
  };
  const create = (metadata: unknown, isFolder: boolean, at = tick()): IFakeDriveFile => {
    const { name, parents } = metadata as { name: string; parents: readonly string[] };
    const parentId = parents[0] ?? 'root';
    const file: IFakeDriveFile = {
      id: nextId('f'),
      name,
      parentId,
      isFolder,
      createdAt: at,
      modifiedAt: at,
      space: spaceOf(parentId),
      headRevisionId: null,
      trashed: false,
    };
    files.set(file.id, file);
    return file;
  };

  const handle = async (url: URL, init: RequestInit): Promise<Response> => {
    const method = init.method ?? 'GET';
    const body = init.body;
    const route = url.href.slice(0, url.href.length - url.search.length);
    const uploadId = url.searchParams.get('upload_id');
    if (method === 'PUT' && !isNil(uploadId)) {
      const upload = uploads.get(uploadId);
      if (isNil(upload)) {
        return driveError(404, 'notFound');
      }
      uploads.delete(uploadId);
      beforeNextUpload?.();
      beforeNextUpload = null;
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const file = isNil(upload.fileId) ? create(upload.metadata, false) : files.get(upload.fileId);
      if (isNil(file)) {
        return driveError(404, 'notFound');
      }
      store(file.id, bytes);
      return json(resource(file));
    }
    if (route === `${API}/files` && method === 'GET') {
      const query = url.searchParams.get('q') ?? '';
      const parentId = unescaped(PARENT_CLAUSE.exec(query)?.[1] ?? '');
      const name = NAME_CLAUSE.exec(query)?.[1];
      const space = url.searchParams.get('spaces') ?? 'drive';
      return json({
        files: [...files.values()]
          .filter(file => file.parentId === parentId && !file.trashed && file.space === space)
          .filter(file => isNil(name) || file.name === unescaped(name))
          .map(resource),
      });
    }
    if (route === `${API}/files` && method === 'POST') {
      const metadata: unknown = JSON.parse(await new Response(body).text());
      return json(resource(create(metadata, true)));
    }
    if (
      route.startsWith(`${UPLOAD_API}/files`) &&
      url.searchParams.get('uploadType') === 'resumable'
    ) {
      const fileId =
        route === `${UPLOAD_API}/files`
          ? null
          : decodeURIComponent(route.slice(`${UPLOAD_API}/files/`.length));
      const id = nextId('u');
      uploads.set(id, { fileId, metadata: JSON.parse(await new Response(body).text()) });
      return json({}, 200, {
        Location: `${UPLOAD_API}/files?uploadType=resumable&upload_id=${id}`,
      });
    }
    const revision = new RegExp(`^${API}/files/([^/]+)/revisions/([^/]+)$`).exec(route);
    if (!isNil(revision) && method === 'GET') {
      const bytes = revisions.get(decodeURIComponent(revision[2] ?? ''));
      return isNil(bytes) ? driveError(404, 'notFound') : new Response(bytes.slice());
    }
    const single = new RegExp(`^${API}/files/([^/]+)$`).exec(route);
    const file = files.get(decodeURIComponent(single?.[1] ?? ''));
    if (isNil(single) || isNil(file)) {
      return driveError(404, 'notFound');
    }
    if (method === 'DELETE') {
      files.delete(file.id);
      return new Response(null, { status: 204 });
    }
    return json(resource(file));
  };

  const fetchFake: typeof fetch = async (input, init = {}) => {
    if (init.signal?.aborted === true) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    if (new Headers(init.headers).get('Authorization') !== `Bearer ${FAKE_TOKEN}`) {
      return driveError(401, 'authError');
    }
    if (!isNil(nextFailure)) {
      const failure = nextFailure;
      nextFailure = null;
      return failure;
    }
    return handle(new URL(String(input)), init);
  };

  return {
    fetch: fetchFake,
    /** Names in path form, folders included, for what the user would see in each space. */
    paths: (space: IFakeDriveFile['space']) => {
      const pathOf = (file: IFakeDriveFile): string => {
        const parent = files.get(file.parentId);
        return isNil(parent) ? file.name : `${pathOf(parent)}/${file.name}`;
      };
      return [...files.values()]
        .filter(file => file.space === space)
        .map(pathOf)
        .sort();
    },
    /** Another device's create that landed first: a file with the same name, older. */
    putAnother: (parentPath: string, name: string, bytes: Uint8Array<ArrayBuffer>) => {
      const parent = [...files.values()].find(file => file.isFolder && file.name === parentPath);
      const created = create({ name, parents: [parent?.id ?? 'root'] }, false, START);
      store(created.id, bytes);
      return created.id;
    },
    /** Something another device does while this one's upload is under way. */
    duringNextUpload: (action: () => void) => {
      beforeNextUpload = action;
    },
    failNextWith: (status: number, reason: string) => {
      nextFailure = driveError(status, reason);
    },
  };
}
