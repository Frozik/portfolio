import { RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { OsmMapStore } from '../../application/OsmMapStore';
import { osmMapT } from '../translations';

const ICON_SIZE_PX = 14;

export const Hud = observer(({ store }: { readonly store: OsmMapStore }) => {
  const { stats } = store;
  return (
    <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-2">
      <div className="rounded-lg bg-neutral-900/70 px-3 py-2 font-mono text-xs text-neutral-200 tabular-nums backdrop-blur">
        <div>{osmMapT.hud.zoom(stats.zoom)}</div>
        <div>{osmMapT.hud.pitch(stats.pitchDeg)}</div>
        <div>{osmMapT.hud.bearing(stats.bearingDeg)}</div>
        <div>{osmMapT.hud.tiles(stats.visibleTiles, stats.loadingTiles)}</div>
        <div>{osmMapT.hud.atlas(stats.atlasUsed, stats.atlasCapacity)}</div>
        <div>{osmMapT.hud.cached(stats.cachedTiles)}</div>
        <div>{osmMapT.hud.buildings(stats.buildingTiles, stats.loadingBuildingTiles)}</div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="pointer-events-auto self-start"
        onClick={store.resetView}
        title={osmMapT.hud.reset}
      >
        <RotateCcw size={ICON_SIZE_PX} />
        {osmMapT.hud.reset}
      </Button>
    </div>
  );
});
