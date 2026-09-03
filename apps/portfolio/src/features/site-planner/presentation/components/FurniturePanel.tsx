import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { FurnitureInstance } from '../../domain/model/furniture';
import type { BuildingId } from '../../domain/model/site-plan';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;

/** One placed piece's row: named, removable. */
const PlacedRow = memo(
  ({
    store,
    buildingId,
    item,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly item: FurnitureInstance;
  }) => {
    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'furniture', buildingId, furnitureId: item.id });
    });
    const handleRemove = useFunction(() => {
      store.storeyObjects.removeFurniture(buildingId, item.id);
    });

    return (
      <div className="flex items-center gap-1.5 rounded-md border border-white/10 p-1.5">
        <button
          type="button"
          onClick={handleSelect}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[11px] text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          {sitePlannerT.furniture.items[item.catalogId]}
        </button>
        <button
          type="button"
          aria-label={sitePlannerT.furniture.remove}
          title={sitePlannerT.furniture.remove}
          onClick={handleRemove}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            'text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          <Trash2 size={GLYPH_SIZE_PX} aria-hidden />
        </button>
      </div>
    );
  }
);

/**
 * The furniture catalogue and the active storey's placed pieces
 * (`building-editor.md` §6): a tile arms the piece, the canvas places it.
 */
export const FurniturePanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.building.editedStoreyScene;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const labels = sitePlannerT.furniture;

  return (
    <PlannerPanel title={labels.panelTitle}>
      {scene.furniture.map(item => (
        <PlacedRow key={item.id} store={store} buildingId={buildingId} item={item} />
      ))}
      {scene.furniture.length === 0 ? <PanelHint>{labels.emptyHint}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
