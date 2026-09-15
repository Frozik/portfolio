import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import { BUILDING_LAYER_IDS } from '../../domain/model/building-layers';
import { sitePlannerT } from '../translations';
import { LAYER_PRESENTATIONS } from './editorTools';
import { LayerEye } from './LayerEye';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 14;

/** One layer's row: its glyph and name, what it holds on this storey, its eye. */
const LayerRow = observer(
  ({ store, layer }: { readonly store: SitePlannerStore; readonly layer: BuildingLayerId }) => {
    const { icon: Icon, label } = LAYER_PRESENTATIONS[layer];
    const isActive = store.layers.activeLayer === layer;
    const count = store.layers.objectCounts[layer];

    const handleActivate = useFunction(() => store.layers.setActiveLayer(layer));

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border p-1.5 transition-colors duration-150',
          isActive ? 'border-brand-500/60' : 'border-white/10 hover:border-brand-500/40'
        )}
      >
        <button
          type="button"
          aria-pressed={isActive}
          onClick={handleActivate}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 text-left text-[11px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            isActive ? 'text-brand-500' : 'text-text'
          )}
        >
          <Icon size={GLYPH_SIZE_PX} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count > 0 ? (
            <span className="shrink-0 font-mono text-[10px] text-text-secondary">{count}</span>
          ) : undefined}
        </button>
        <LayerEye store={store} layer={layer} />
      </div>
    );
  }
);

/**
 * The layers of the open building as a card in the column (`layers.md` §8):
 * one row each, the active one lit, an eye apiece, and the two sweeps —
 * the Photoshop panel, sized to this column. The rail's layer button lists
 * the same rows for the narrow screen, where the column is a drawer.
 */
export const LayersPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.layers;

  return (
    <PlannerPanel title={labels.panelTitle}>
      {BUILDING_LAYER_IDS.map(layer => (
        <LayerRow key={layer} store={store} layer={layer} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" onClick={store.layers.hideOtherLayers}>
          {labels.hideOthers}
        </Button>
        <Button variant="secondary" size="sm" onClick={store.layers.showAllLayers}>
          {labels.showAll}
        </Button>
      </div>
    </PlannerPanel>
  );
});
