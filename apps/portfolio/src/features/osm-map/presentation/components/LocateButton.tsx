import { LocateFixed } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { cn } from '@frozik/components/components/cn';

import type { OsmMapStore } from '../../application/OsmMapStore';
import { osmMapT } from '../translations';

const ICON_SIZE_PX = 20;

/**
 * Asks the browser where the user is and centres the map there; pulses while
 * the answer is out and says so when the browser has no position to give.
 */
export const LocateButton = observer(({ store }: { readonly store: OsmMapStore }) => {
  const label = store.locating ? osmMapT.hud.locating : osmMapT.hud.locate;
  return (
    <div className="absolute top-[4.25rem] right-3 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={store.locate}
        aria-label={label}
        title={label}
        aria-busy={store.locating}
        className={cn(
          'flex size-11 items-center justify-center rounded-full bg-neutral-900/70 text-neutral-200 shadow-lg backdrop-blur transition-transform hover:scale-110 active:scale-95',
          store.locating && 'animate-pulse'
        )}
      >
        <LocateFixed size={ICON_SIZE_PX} aria-hidden="true" />
      </button>
      {store.locateFailure !== undefined && (
        <p
          role="alert"
          className="max-w-64 rounded bg-neutral-900/80 px-3 py-2 text-right font-mono text-xs text-neutral-200"
        >
          {osmMapT.hud.locateFailure[store.locateFailure]}
        </p>
      )}
    </div>
  );
});
