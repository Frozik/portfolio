import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { Check } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { EditedObjectDescriptor } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { MODE_BAR_EXTRAS } from './editorTools';

const ICON_SIZE_PX = 14;

function editedObjectName(edited: EditedObjectDescriptor): string {
  switch (edited.kind) {
    case 'site':
      return sitePlannerT.modes.siteName;
    case 'building':
      return edited.name;
    case 'path':
      return `${sitePlannerT.modes.pathName} ${edited.ordinal}`;
    case 'utilityRoute':
      return `${sitePlannerT.modes.routeName} ${edited.ordinal}`;
    default:
      return assertNever(edited);
  }
}

/**
 * The breadcrumb of the mode system: absent while viewing, and while an editor
 * is open — the one always-visible answer to "what am I editing", named after
 * the very object that was descended into, with the one obvious way back
 * (Fusion 360's Finish Sketch, sized to our toolbar). Esc, Tab and a
 * double-click on emptiness leave too; this button is for the person who knows
 * none of that yet.
 */
export const ModeBar = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const edited = store.editedObject;
  const mode = store.editorMode;

  if (isNil(edited) || mode.kind !== 'edit') {
    return null;
  }

  const Extra = MODE_BAR_EXTRAS[mode.target.kind];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 py-0.5 pl-2.5 pr-0.5">
      <span className="text-xs font-medium text-brand-500">
        {`${editedObjectName(edited)} — ${sitePlannerT.modes.editingSuffix}`}
      </span>
      {isNil(Extra) ? undefined : <Extra store={store} />}
      <Button size="sm" onClick={store.exitEditMode}>
        <Check size={ICON_SIZE_PX} aria-hidden />
        {sitePlannerT.modes.done}
      </Button>
    </div>
  );
});
