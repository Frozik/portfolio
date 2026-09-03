import { useFunction } from '@frozik/components/hooks/useFunction';
import { Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingPresetId } from '../../domain/model/building-presets';
import { BUILDING_PRESETS } from '../../domain/model/building-presets';
import type { Building } from '../../domain/model/site-plan';
import { sitePlannerT } from '../translations';
import { PlannerPanel } from './PlannerPanel';
import { GroupSection } from './StructureTermTree';

const ICON_SIZE_PX = 14;

/**
 * The scene tree: the plot and the house with their CSG terms. Selecting a group
 * header is what decides where a newly drawn shape lands. Lives in site editing
 * — reshaping the ground plan is what that mode is (see modes.md).
 */
/** One preset in the add-building menu: дом, сарай, навес (R19 — data, not editors). */
const BuildingPresetItem = memo(
  ({
    presetId,
    onSelect,
  }: {
    readonly presetId: BuildingPresetId;
    readonly onSelect: (presetId: BuildingPresetId) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(presetId));

    return (
      <DropdownItem onSelect={handleSelect} className="gap-2 py-1.5 text-xs">
        <Plus size={ICON_SIZE_PX} className="shrink-0" aria-hidden />
        {sitePlannerT.structure.presets[presetId]}
      </DropdownItem>
    );
  }
);

export const StructurePanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const handleAddBuilding = useFunction((presetId: BuildingPresetId) => {
    store.building.addBuilding(
      `${sitePlannerT.structure.presets[presetId]} ${store.buildings.length + 1}`,
      presetId
    );
  });

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
      <Dropdown
        trigger={
          <Button variant="ghost" size="sm">
            <Plus size={ICON_SIZE_PX} aria-hidden />
            {sitePlannerT.structure.addBuilding}
          </Button>
        }
      >
        {BUILDING_PRESETS.map(preset => (
          <BuildingPresetItem key={preset.id} presetId={preset.id} onSelect={handleAddBuilding} />
        ))}
      </Dropdown>
    </PlannerPanel>
  );
});

/** One named structure: its term tree under its name, removable as a whole. */
const BuildingSection = observer(
  ({ store, building }: { readonly store: SitePlannerStore; readonly building: Building }) => {
    const handleRemove = useFunction(() => store.building.removeBuilding(building.id));

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
