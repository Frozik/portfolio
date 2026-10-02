import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';

import type { OsmMapStore } from '../../application/OsmMapStore';
import { osmMapT } from '../translations';

/**
 * A shimmering line along the top edge while tiles — raster or street — are
 * on their way. It lies over the map and takes no room, so nothing shifts
 * when it comes and goes.
 */
export const LoadingBar = observer(({ store }: { readonly store: OsmMapStore }) => {
  const { loading } = store;
  return (
    <div
      role="progressbar"
      aria-label={osmMapT.hud.loading}
      aria-hidden={!loading}
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-2 animate-loading-shimmer bg-[linear-gradient(90deg,var(--color-brand-600),var(--color-brand-300),var(--color-brand-600))] bg-[length:200%_100%] transition-opacity duration-300',
        loading ? 'opacity-100' : 'opacity-0 [animation-play-state:paused]'
      )}
    />
  );
});
