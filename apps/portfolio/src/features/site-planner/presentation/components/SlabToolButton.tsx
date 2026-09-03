import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { ShapeTool } from '../../domain/model/selection';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { SHAPE_TOOL_GROUPS, SHAPE_TOOL_ICONS } from './ShapeToolButton';

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:slab')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's floor tool. A storey's floor is drawn with the very primitives the
 * plot is drawn with, so this button offers the same flyout as the palette's
 * shape tool and shares the armed primitive with it — one thing to learn, and
 * the choice carries between the two editors.
 */
export const SlabToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedTool = store.armedShapeTool;
    const ArmedIcon = SHAPE_TOOL_ICONS[armedTool];

    const handleActivate = useFunction(() => store.setActiveTool('building:slab'));

    const handleChoose = useFunction((tool: ShapeTool) => {
      store.setArmedShapeTool(tool);
      store.setActiveTool('building:slab');
    });

    const label = `${sitePlannerT.slabs.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.tools[armedTool]}`}
        menuLabel={sitePlannerT.tools.shapeMenu}
        icon={<ArmedIcon size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:slab'}
        side={side}
        armedKey={armedTool}
        groups={SHAPE_TOOL_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
