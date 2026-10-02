/** Page → worker: start (or resume) downloading the offline pack. */
export const OFFLINE_PACK_WARM = 'offline-pack/warm';
/** Page → worker: report the current pack status. */
export const OFFLINE_PACK_QUERY = 'offline-pack/query';
/** Worker → every window: the pack status, sent on query and after every downloaded file. */
export const OFFLINE_PACK_STATUS = 'offline-pack/status';

export type TOfflinePackRequest =
  | { readonly type: typeof OFFLINE_PACK_WARM }
  | { readonly type: typeof OFFLINE_PACK_QUERY };

export type TOfflinePackStatus =
  | { readonly state: 'ready'; readonly total: number }
  | { readonly state: 'incomplete'; readonly cached: number; readonly total: number }
  | { readonly state: 'downloading'; readonly cached: number; readonly total: number }
  | { readonly state: 'failed'; readonly cached: number; readonly total: number };

export interface IOfflinePackStatusMessage {
  readonly type: typeof OFFLINE_PACK_STATUS;
  readonly status: TOfflinePackStatus;
}

export function isOfflinePackStatusMessage(data: unknown): data is IOfflinePackStatusMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === OFFLINE_PACK_STATUS &&
    'status' in data
  );
}

export function isOfflinePackRequest(data: unknown): data is TOfflinePackRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data.type === OFFLINE_PACK_WARM || data.type === OFFLINE_PACK_QUERY)
  );
}
