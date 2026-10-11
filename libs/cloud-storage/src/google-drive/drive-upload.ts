import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TStorageResult } from '../core/storage-error';
import type { IDriveFile } from './drive-files';
import { driveFileOf, FILE_FIELDS } from './drive-files';
import type { IDriveRequest, IDriveTransport } from './drive-transport';
import { DRIVE_UPLOAD_API } from './drive-transport';

const BINARY = 'application/octet-stream';

/**
 * Drive's resumable upload in one go: the first request carries the
 * metadata and returns the session URL, the second the bytes. It takes any
 * size (the simple upload stops at 5 MB) at the cost of one extra request.
 */
async function uploadResumable(
  transport: IDriveTransport,
  start: Omit<IDriveRequest, 'headers'>,
  bytes: Uint8Array<ArrayBuffer>,
  signal: AbortSignal
): Promise<TStorageResult<IDriveFile>> {
  const started = await transport.send(
    {
      ...start,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': BINARY,
        'X-Upload-Content-Length': String(bytes.length),
      },
    },
    signal
  );
  if (!started.ok) {
    return started;
  }
  const session = started.value.headers.get('Location');
  if (isNil(session)) {
    return err({ kind: 'server', status: started.value.status });
  }
  const uploaded = await transport.send(
    { method: 'PUT', url: session, headers: { 'Content-Type': BINARY }, body: bytes },
    signal
  );
  if (!uploaded.ok) {
    return uploaded;
  }
  const json = await transport.jsonOf(uploaded.value, signal);
  if (!json.ok) {
    return json;
  }
  const file = driveFileOf(json.value);
  return isNil(file) ? err({ kind: 'server', status: uploaded.value.status }) : ok(file);
}

export function uploadNew(
  transport: IDriveTransport,
  { name, parentId }: { readonly name: string; readonly parentId: string },
  bytes: Uint8Array<ArrayBuffer>,
  signal: AbortSignal
): Promise<TStorageResult<IDriveFile>> {
  return uploadResumable(
    transport,
    {
      method: 'POST',
      url: `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
      body: JSON.stringify({ name, parents: [parentId], mimeType: BINARY }),
    },
    bytes,
    signal
  );
}

export function uploadOver(
  transport: IDriveTransport,
  fileId: string,
  bytes: Uint8Array<ArrayBuffer>,
  signal: AbortSignal
): Promise<TStorageResult<IDriveFile>> {
  return uploadResumable(
    transport,
    {
      method: 'PATCH',
      url: `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=resumable&fields=${FILE_FIELDS}`,
      body: '{}',
    },
    bytes,
    signal
  );
}
