import { Redo2, Undo2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';
import { ToolbarIconButton } from './ToolbarIconButton';

/** Undo and redo of plan edits; the chords they advertise live in the plan input layer. */
export const HistoryControls = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <div className="flex items-center gap-1">
    <ToolbarIconButton
      icon={Undo2}
      label={`${sitePlannerT.history.undo} (${sitePlannerT.history.undoHotkey})`}
      isEnabled={store.history.canUndo}
      onActivate={store.document.undo}
    />
    <ToolbarIconButton
      icon={Redo2}
      label={`${sitePlannerT.history.redo} (${sitePlannerT.history.redoHotkey})`}
      isEnabled={store.history.canRedo}
      onActivate={store.document.redo}
    />
  </div>
));
