import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingId } from '../../domain/model/building';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { Wall } from '../../domain/model/walls';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;

/** One wall's row: its place in the run, construction, and a way out. */
const WallRow = observer(
  ({
    store,
    buildingId,
    wall,
    ordinal,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly wall: Wall;
    readonly ordinal: number;
  }) => {
    const labels = sitePlannerT.walls;
    const isSelected = store.walls.selectedWall?.id === wall.id;

    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'wall', buildingId, wallId: wall.id });
    });
    const handleRemove = useFunction(() => {
      store.walls.removeWall(buildingId, wall.id);
    });

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border p-1.5 transition-colors duration-150',
          isSelected ? 'border-brand-500/60' : 'border-white/10 hover:border-brand-500/40'
        )}
      >
        <button
          type="button"
          onClick={handleSelect}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[11px] text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          {`${labels.wallTitle} ${ordinal}`}
          <span className="text-text-secondary">
            {` · ${labels.materials[wall.material]} · ${wall.thicknessMeters.toFixed(METER_DECIMALS)}`}
          </span>
        </button>
        <button
          type="button"
          aria-label={labels.remove}
          title={labels.remove}
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

/** The building editor's wall inventory: select from the list, remove, or read. */
export const WallsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.storeys.editedStoreyScene;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const walls = scene.storey.walls;
  const labels = sitePlannerT.walls;

  return (
    <PlannerPanel title={labels.panelTitle}>
      {walls.map((wall, index) => (
        <WallRow
          key={wall.id}
          store={store}
          buildingId={buildingId}
          wall={wall}
          ordinal={index + 1}
        />
      ))}
      {isNil(store.walls.selectedJunction) ? undefined : (
        <PanelHint>{labels.junctionHint}</PanelHint>
      )}
      <PanelHint>{walls.length === 0 ? labels.emptyHint : labels.hint}</PanelHint>
    </PlannerPanel>
  );
});
