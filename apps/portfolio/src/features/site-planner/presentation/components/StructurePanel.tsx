import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { Building } from '../../domain/model/building';
import { sitePlannerT } from '../translations';
import { PlannerPanel } from './PlannerPanel';
import { GroupSection } from './StructureTermTree';

/**
 * The scene tree: the plot and the house with their CSG terms. Selecting a group
 * header is what decides where a newly drawn shape lands. Lives in site editing
 * — reshaping the ground plan is what that mode is (see modes.md).
 */

export const StructurePanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  return (
    <PlannerPanel title={sitePlannerT.structure.title}>
      <GroupSection
        store={store}
        owner="boundary"
        title={sitePlannerT.structure.boundary}
        emptyHint={sitePlannerT.structure.emptyBoundary}
      />
      {store.buildings.map(building => (
        <BuildingSection key={building.id} store={store} building={building} />
      ))}
    </PlannerPanel>
  );
});

/** One named structure: its term tree under its name, removable as a whole. */
const BuildingSection = observer(
  ({ store, building }: { readonly store: SitePlannerStore; readonly building: Building }) => {
    const handleRemove = useEventCallback(() => store.building.removeBuilding(building.id));

    return (
      <GroupSection
        store={store}
        owner={building.id}
        title={building.name}
        emptyHint={sitePlannerT.structure.emptyHouse}
        onRemove={handleRemove}
      />
    );
  }
);
