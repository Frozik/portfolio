import { err, ok } from '@frozik/utils/result/result';
import { isNil, sortBy, uniqBy } from 'lodash-es';

import type { TStorageResult } from '../core/storage-error';
import type {
  IStorageCapabilities,
  IStorageObject,
  IStorageProvider,
  TRemoveResult,
  TStoragePath,
  TWriteResult,
} from '../core/storage-provider';
import { isPreconditionMet } from '../core/write-precondition';
import type { IDriveFile } from './drive-files';
import { listChildren, statOf } from './drive-files';
import { childPath, deleteFile, fileAt, folderIdOf, nameOf, parentOf } from './drive-folders';
import type { TDriveSpace } from './drive-space';
import type { IDriveTransport } from './drive-transport';
import { DRIVE_API } from './drive-transport';
import { uploadNew, uploadOver } from './drive-upload';

const HTTP_NOT_FOUND = 404;
/** Attempts at reading the head revision before saying the file is too busy. */
const READ_ATTEMPTS = 3;

function capabilitiesOf(space: TDriveSpace): IStorageCapabilities {
  return {
    conditionalWrite: 'check-then-write',
    revisionKind: 'rev',
    pinnedRead: true,
    revisions: false,
    maxSimpleUploadBytes: Number.MAX_SAFE_INTEGER,
    authRenewal: 'gesture',
    cors: 'open',
    appScopedFolder: space === 'app-data',
  };
}

function fileUrl(fileId: string): string {
  return `${DRIVE_API}/files/${encodeURIComponent(fileId)}`;
}

/**
 * Drive v3 in My Drive (`drive.file`) or the app's hidden
 * folder (`drive.appdata`). Paths are walked by name from the space's root;
 * a read is pinned to the head revision it stat'ed; a write checks the head
 * first (Drive has no compare-and-swap), and a create that raced another one
 * keeps the oldest file and removes its own.
 */
export function createGoogleDriveProvider({
  transport,
  space,
}: {
  readonly transport: IDriveTransport;
  readonly space: TDriveSpace;
}): IStorageProvider {
  const located = async (
    path: TStoragePath,
    signal: AbortSignal
  ): Promise<TStorageResult<IDriveFile | null>> => {
    const found = await fileAt(transport, space, path, signal);
    return found.ok ? ok(found.value?.file ?? null) : found;
  };

  const readPinned = async (
    path: TStoragePath,
    signal: AbortSignal
  ): Promise<TStorageResult<IStorageObject | null>> => {
    for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
      const file = await located(path, signal);
      if (!file.ok || isNil(file.value)) {
        return file.ok ? ok(null) : file;
      }
      const { id, headRevisionId } = file.value;
      if (isNil(headRevisionId)) {
        return err({ kind: 'server', status: HTTP_NOT_FOUND });
      }
      const got = await transport.send(
        {
          method: 'GET',
          url: `${fileUrl(id)}/revisions/${encodeURIComponent(headRevisionId)}?alt=media`,
        },
        signal,
        [HTTP_NOT_FOUND]
      );
      if (!got.ok) {
        return got;
      }
      if (got.value.status === HTTP_NOT_FOUND) {
        continue;
      }
      const bytes = await transport.bytesOf(got.value, signal);
      return bytes.ok ? ok({ bytes: bytes.value, stat: statOf(file.value, path) }) : bytes;
    }
    return err({ kind: 'rate-limited', retryAfter: null });
  };

  const create = async (
    path: TStoragePath,
    bytes: Uint8Array<ArrayBuffer>,
    signal: AbortSignal
  ): Promise<TStorageResult<TWriteResult>> => {
    const parentId = await folderIdOf(transport, space, parentOf(path), true, signal);
    if (!parentId.ok || isNil(parentId.value)) {
      return parentId.ok ? err({ kind: 'not-found' }) : parentId;
    }
    const name = nameOf(path);
    const created = await uploadNew(transport, { name, parentId: parentId.value }, bytes, signal);
    if (!created.ok) {
      return created;
    }
    const siblings = await listChildren(transport, space, parentId.value, { name }, signal);
    if (!siblings.ok) {
      return siblings;
    }
    const kept = siblings.value.find(file => !file.isFolder) ?? created.value;
    if (kept.id === created.value.id) {
      return ok({ kind: 'ok', stat: statOf(created.value, path) });
    }
    await deleteFile(transport, created.value.id, signal);
    return ok({ kind: 'conflict', current: statOf(kept, path) });
  };

  return {
    kind: 'google-drive',
    capabilities: capabilitiesOf(space),
    stat: async (path, signal) => {
      const file = await located(path, signal);
      return file.ok ? ok(isNil(file.value) ? null : statOf(file.value, path)) : file;
    },
    read: readPinned,
    write: async (path, bytes, precondition, signal) => {
      const current = await located(path, signal);
      if (!current.ok) {
        return current;
      }
      const currentStat = isNil(current.value) ? null : statOf(current.value, path);
      if (!isPreconditionMet(precondition, currentStat)) {
        return ok({ kind: 'conflict', current: currentStat });
      }
      if (isNil(current.value)) {
        return create(path, bytes, signal);
      }
      const uploaded = await uploadOver(transport, current.value.id, bytes, signal);
      return uploaded.ok ? ok({ kind: 'ok', stat: statOf(uploaded.value, path) }) : uploaded;
    },
    remove: async (path, precondition, signal): Promise<TStorageResult<TRemoveResult>> => {
      const current = await located(path, signal);
      if (!current.ok) {
        return current;
      }
      if (isNil(current.value)) {
        return err({ kind: 'not-found' });
      }
      const currentStat = statOf(current.value, path);
      if (!isPreconditionMet(precondition, currentStat)) {
        return ok({ kind: 'conflict', current: currentStat });
      }
      const deleted = await transport.send(
        { method: 'DELETE', url: fileUrl(current.value.id) },
        signal,
        [HTTP_NOT_FOUND]
      );
      if (!deleted.ok) {
        return deleted;
      }
      return deleted.value.status === HTTP_NOT_FOUND
        ? err({ kind: 'not-found' })
        : ok({ kind: 'removed' });
    },
    list: async (directory, signal) => {
      const folderId = await folderIdOf(transport, space, directory, false, signal);
      if (!folderId.ok || isNil(folderId.value)) {
        return folderId.ok ? ok([]) : folderId;
      }
      const children = await listChildren(transport, space, folderId.value, {}, signal);
      if (!children.ok) {
        return children;
      }
      const files = uniqBy(
        children.value.filter(file => !file.isFolder),
        file => file.name
      ).map(file => statOf(file, childPath(directory, file.name)));
      return ok(sortBy(files, stat => stat.path));
    },
  };
}
