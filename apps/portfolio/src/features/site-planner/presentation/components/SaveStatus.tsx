import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import type { SitePlanSaveState } from '../../application/PlanPersistence';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';

const DOT_CLASS = 'size-1.5 shrink-0 rounded-full';

function describeSaveState(saveState: SitePlanSaveState): {
  readonly caption: string;
  readonly markerClass: string;
} {
  switch (saveState) {
    case 'saved':
      return { caption: sitePlannerT.save.saved, markerClass: `${DOT_CLASS} bg-success` };
    case 'saving':
      return {
        caption: sitePlannerT.save.saving,
        // The dot spins up into a ring rather than swapping in a second glyph,
        // so the row's width never twitches as the state changes.
        markerClass: `${DOT_CLASS} animate-spin border border-brand-500 border-t-transparent`,
      };
    case 'error':
      return { caption: sitePlannerT.save.error, markerClass: `${DOT_CLASS} bg-error` };
    case 'blocked':
      return { caption: sitePlannerT.save.blocked, markerClass: `${DOT_CLASS} bg-warning` };
    default:
      return assertNever(saveState);
  }
}

/** Whether the plan in storage is the plan on screen — the toolbar's last word. */
export const SaveStatus = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { caption, markerClass } = describeSaveState(store.persistence.saveState);

  return (
    // `status` carries a polite live region, so a change is announced without
    // taking the caption's place the way a label on the element would.
    <p
      role="status"
      className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-text-secondary"
    >
      <span className={markerClass} aria-hidden />
      <span className="sr-only">{sitePlannerT.save.label}</span>
      {caption}
    </p>
  );
});
