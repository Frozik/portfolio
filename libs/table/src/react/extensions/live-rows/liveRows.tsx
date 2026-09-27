import type { IExtensionInstance, ITableExtension } from '../../../core/kernel/extension';
import type { IViewContributions } from '../../slots';
import { NewRowsChip } from './NewRowsChip';

/** The toolbar chip of a log source: buffered live rows, or the note that the stream is stopped. */
export function liveRows<TRow = never>(): ITableExtension<TRow, 'liveRows', undefined> {
  return {
    id: 'liveRows',
    create(): IExtensionInstance<TRow, undefined> {
      const view: IViewContributions<TRow> = {
        toolbar: [{ id: 'liveRows.chip', render: NewRowsChip }],
      };
      return {
        slice: undefined,
        view: view as Readonly<Record<string, unknown>>,
        dispose: () => undefined,
      };
    },
  };
}
