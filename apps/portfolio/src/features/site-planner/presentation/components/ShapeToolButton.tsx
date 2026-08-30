import { useFunction } from '@frozik/components/hooks/useFunction';
import type { LucideIcon } from 'lucide-react';
import { Circle, Square } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { isPlanTool } from '../../domain/model/editor-mode';
import type { ShapeTool } from '../../domain/model/selection';
import { isShapeTool, SHAPE_TOOLS } from '../../domain/model/selection';
import { FLYOUT_ICON_SIZE_PX, TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { TOOL_HOTKEYS } from './toolHotkeys';

const SHAPE_TOOL_LABELS: Record<ShapeTool, string> = {
  rectangle: sitePlannerT.tools.rectangle,
  circle: sitePlannerT.tools.circle,
};

const SHAPE_TOOL_ICONS: Record<ShapeTool, LucideIcon> = {
  rectangle: Square,
  circle: Circle,
};

/** One unheaded run: every shape the plan can be drawn with belongs to the same family. */
const SHAPE_TOOL_GROUPS: readonly FlyoutVariantGroup<ShapeTool>[] = [
  {
    key: 'shapes',
    variants: SHAPE_TOOLS.map(tool => {
      const Icon = SHAPE_TOOL_ICONS[tool];

      return {
        key: tool,
        label: SHAPE_TOOL_LABELS[tool],
        hotkey: TOOL_HOTKEYS[tool],
        icon: <Icon size={FLYOUT_ICON_SIZE_PX} aria-hidden />,
        value: tool,
      };
    }),
  },
];

/**
 * The palette's drawing tool. Rectangle and circle draw the same kind of term and
 * differ only in the outline they leave, so they share a button and the flyout
 * picks between them; the R and C keys still reach each of them directly, and the
 * button follows whichever was reached last.
 */
export const ShapeToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedTool = store.armedShapeTool;
    const ArmedIcon = SHAPE_TOOL_ICONS[armedTool];

    const handleActivate = useFunction(() => store.setActiveTool(armedTool));

    return (
      <FlyoutToolButton
        title={`${SHAPE_TOOL_LABELS[armedTool]} (${TOOL_HOTKEYS[armedTool]})`}
        menuLabel={sitePlannerT.tools.shapeMenu}
        icon={<ArmedIcon size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={isPlanTool(store.activeTool) && isShapeTool(store.activeTool)}
        side={side}
        armedKey={armedTool}
        groups={SHAPE_TOOL_GROUPS}
        onActivate={handleActivate}
        onChoose={store.setActiveTool}
      />
    );
  }
);
