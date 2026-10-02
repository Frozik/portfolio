import type { TBatch, TShape } from '../../core/series/shape';
import type { ISnapshotSource } from './source';

/**
 * A snapshot source over data the application already holds: every answer is
 * the whole set, so panning and zooming ask for nothing and only a change
 * makes the chart read again (§4.5).
 */
export function snapshotOf<TX>(
  read: (shape: TShape) => TBatch<TX>,
  subscribe: (onChange: VoidFunction) => VoidFunction
): ISnapshotSource<TX> {
  return {
    fetch: async request => ({ data: read(request.shape) }),
    subscribe: onChange => subscribe(() => onChange()),
  };
}
