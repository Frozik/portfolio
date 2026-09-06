import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { BookOpen, CarFront, Home, HousePlus, LandPlot, Warehouse } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingPresetId } from '../../domain/model/building-presets';
import { BUILDING_PRESETS } from '../../domain/model/building-presets';
import type { EditorToolSpec } from '../../domain/model/editor-mode';
import { isSiteEditMode } from '../../domain/model/editor-mode';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import { EDITOR_TOOL_PRESENTATIONS } from './editorTools';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { StockHouseDialog } from './StockHouseDialog';

/** The rail's doors into the site and building editors, and the tools an open editor contributes. */
/**
 * The rail's door into site editing. It reads as a tool — lit while its editor
 * is open — and a second press steps back out, so the rail alone can walk the
 * whole mode round trip.
 */
export const SiteEditorButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const isActive = isSiteEditMode(store.editorMode) && !store.modes.isEditingBuilding;

    const handleToggle = useFunction(() => {
      if (store.modes.isEditingBuilding) {
        // The editor stays open — the aim just moves from the house to the plot.
        store.composition.setActiveGroup('boundary');
      } else if (isSiteEditMode(store.editorMode)) {
        store.exitEditMode();
      } else {
        store.enterEditMode({ kind: 'site' });
      }
    });

    return (
      <Tooltip title={sitePlannerT.modes.editSite} placement={side}>
        <button
          type="button"
          aria-label={sitePlannerT.modes.editSite}
          aria-pressed={isActive}
          onClick={handleToggle}
          className={railButtonClass(isActive)}
        >
          <LandPlot size={TOOL_ICON_SIZE_PX} aria-hidden />
        </button>
      </Tooltip>
    );
  }
);

/** What the building door's corner menu can do: blank presets and the catalogue. */
type HouseDoorAction =
  | { readonly kind: 'stock-catalog' }
  | { readonly kind: 'preset'; readonly presetId: BuildingPresetId };

/**
 * The building's door: the same site editor, opened aimed at the house group.
 * Its corner triangle carries the door's menu («catalogs beat tools»):
 * the stock-house catalogue opens from here rather
 * than standing on the rail as a tool of its own.
 */
export const HouseEditorButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const isActive = store.modes.isEditingBuilding;
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);

    const handleToggle = useFunction(() => {
      if (store.modes.isEditingBuilding) {
        store.exitEditMode();
      } else {
        store.building.enterBuildingEditing(sitePlannerT.structure.house);
      }
    });
    const handleAction = useFunction((action: HouseDoorAction) => {
      switch (action.kind) {
        case 'stock-catalog':
          setIsCatalogOpen(true);

          return;
        case 'preset':
          store.building.addBuilding(
            `${sitePlannerT.structure.presets[action.presetId]} ${store.buildings.length + 1}`,
            action.presetId
          );

          return;
        default:
          assertNever(action);
      }
    });
    const handleCatalogClose = useFunction(() => setIsCatalogOpen(false));

    return (
      <>
        <FlyoutToolButton<HouseDoorAction>
          title={sitePlannerT.modes.editHouse}
          menuLabel={sitePlannerT.stockHouses.menu}
          icon={<Home size={TOOL_ICON_SIZE_PX} aria-hidden />}
          isActive={isActive}
          side={side}
          armedKey=""
          groups={HOUSE_DOOR_MENU}
          onActivate={handleToggle}
          onChoose={handleAction}
        />
        <StockHouseDialog store={store} open={isCatalogOpen} onClose={handleCatalogClose} />
      </>
    );
  }
);

const PRESET_MENU_ICONS: Readonly<Record<BuildingPresetId, ReactNode>> = {
  house: <HousePlus size={TOOL_ICON_SIZE_PX} aria-hidden />,
  shed: <Warehouse size={TOOL_ICON_SIZE_PX} aria-hidden />,
  carport: <CarFront size={TOOL_ICON_SIZE_PX} aria-hidden />,
};

const HOUSE_DOOR_MENU: readonly FlyoutVariantGroup<HouseDoorAction>[] = [
  {
    key: 'new-building',
    title: sitePlannerT.structure.addBuilding,
    variants: BUILDING_PRESETS.map(preset => ({
      key: preset.id,
      label: sitePlannerT.structure.presets[preset.id],
      icon: PRESET_MENU_ICONS[preset.id],
      value: { kind: 'preset', presetId: preset.id },
    })),
  },
  {
    key: 'stock-catalog',
    variants: [
      {
        key: 'stock-catalog',
        label: sitePlannerT.stockHouses.menuItem,
        icon: <BookOpen size={TOOL_ICON_SIZE_PX} aria-hidden />,
        value: { kind: 'stock-catalog' },
      },
    ],
  },
];

/**
 * A tool the open editor contributed (`OBJECT_EDITOR_SPECS`), rendered from
 * its presentation registry entry. Unregistered means invisible — the
 * contributing editor's own test keeps the two tables in step.
 */
export const EditorToolButton = observer(
  ({
    spec,
    store,
    side,
  }: {
    readonly spec: EditorToolSpec;
    readonly store: SitePlannerStore;
    readonly side: FlyoutSide;
  }) => {
    const presentation = EDITOR_TOOL_PRESENTATIONS[spec.id];
    const handleClick = useFunction(() => store.setActiveTool(spec.id));

    if (isNil(presentation)) {
      return null;
    }

    if (!isNil(presentation.Flyout)) {
      return <presentation.Flyout store={store} side={side} />;
    }

    const { icon: Icon, label } = presentation;
    const title = isNil(spec.hotkey) ? label : `${label} (${spec.hotkey.toUpperCase()})`;

    return (
      <Tooltip title={title} placement={side}>
        <button
          type="button"
          aria-label={title}
          aria-pressed={store.activeTool === spec.id}
          onClick={handleClick}
          className={railButtonClass(store.activeTool === spec.id)}
        >
          <Icon size={TOOL_ICON_SIZE_PX} aria-hidden />
        </button>
      </Tooltip>
    );
  }
);

function railButtonClass(isActive: boolean): string {
  return cn(
    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
    isActive ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-white/10 hover:text-text'
  );
}
