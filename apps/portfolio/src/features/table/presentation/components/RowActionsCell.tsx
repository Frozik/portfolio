import { observer } from 'mobx-react-lite';

import type { IEditingSlice } from '@frozik/table/extensions/editing/contracts';
import type { ICellContext } from '@frozik/table/react/column';

import type { IDemoTrade } from '../../domain/demo-trade';
import { tableDemoT } from '../translations';

const BUTTON_CLASS =
  'rounded px-1 text-xs leading-5 text-landing-fg-dim hover:bg-landing-bg-elev hover:text-landing-fg';

/** The row API from inside a cell: in confirm mode an edited row shows apply and revert until the application takes it. */
export const RowActionsCell = observer(function RowActionsCell({
  table,
  rowKey,
}: ICellContext<IDemoTrade>) {
  const editing = table.extension<IEditingSlice<IDemoTrade>>('editing');
  if (editing === undefined || !editing.isEdited(rowKey) || editing.updating.has(rowKey)) {
    return null;
  }
  return (
    <span className="flex h-full items-center justify-center gap-1">
      <button
        type="button"
        className={BUTTON_CLASS}
        title={tableDemoT.actions.confirm}
        onClick={() => editing.confirm(rowKey)}
      >
        ✓
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        title={tableDemoT.actions.revert}
        onClick={() => editing.revert(rowKey)}
      >
        ↺
      </button>
    </span>
  );
});
