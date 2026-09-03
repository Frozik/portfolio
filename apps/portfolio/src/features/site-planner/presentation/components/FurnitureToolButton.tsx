import { useFunction } from '@frozik/components/hooks/useFunction';
import { Armchair } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { FurnitureCatalogId, FurnitureCategory } from '../../domain/model/furniture';
import { FURNITURE_CATALOG } from '../../domain/model/furniture';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

/** Household pieces read warm wood, fixtures cool porcelain — the plan's hues. */
const CATEGORY_DOT_COLORS: Readonly<Record<FurnitureCategory, string>> = {
  furniture: '#c49a6c',
  plumbing: '#bad2eb',
};

const CategoryDot = ({ category }: { readonly category: FurnitureCategory }) => (
  <span
    className="inline-block size-2.5 rounded-full"
    style={{ backgroundColor: CATEGORY_DOT_COLORS[category] }}
  />
);

const CATALOG_GROUPS: readonly FlyoutVariantGroup<FurnitureCatalogId>[] = (
  [
    ['furniture', sitePlannerT.furniture.furnitureGroup],
    ['plumbing', sitePlannerT.furniture.plumbingGroup],
  ] as const
).map(([category, title]) => ({
  key: category,
  title,
  variants: FURNITURE_CATALOG.filter(entry => entry.category === category).map(entry => ({
    key: entry.id,
    label: sitePlannerT.furniture.items[entry.id],
    icon: <CategoryDot category={category} />,
    value: entry.id,
  })),
}));

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:furniture')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's furniture tool: one button armed with a catalogue piece, and the
 * flyout to arm it from — the placing tool's pattern brought indoors.
 */
export const FurnitureToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedId = store.storeyObjects.armedFurnitureId;

    const handleActivate = useFunction(() => store.setActiveTool('building:furniture'));

    const handleChoose = useFunction((catalogId: FurnitureCatalogId) => {
      store.storeyObjects.setArmedFurnitureId(catalogId);
      store.setActiveTool('building:furniture');
    });

    const label = `${sitePlannerT.furniture.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.furniture.items[armedId]}`}
        menuLabel={sitePlannerT.tools.furnitureMenu}
        icon={<Armchair size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:furniture'}
        side={side}
        armedKey={armedId}
        groups={CATALOG_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
