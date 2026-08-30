import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react';
import { Flag, Hand, Home, LandPlot, MousePointer2, Route, Ruler } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { EditorMode, EditorToolSpec } from '../../domain/model/editor-mode';
import {
  allowedPlanTools,
  isSiteEditMode,
  OBJECT_EDITOR_SPECS,
} from '../../domain/model/editor-mode';
import type { PlanTool, ShapeTool } from '../../domain/model/selection';
import type { PLACED_OBJECT_TOOL } from '../constants';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import { EDITOR_TOOL_PRESENTATIONS } from './editorTools';
import type { FlyoutSide } from './FlyoutToolButton';
import { PlacedObjectToolButton } from './PlacedObjectToolButton';
import { ShapeToolButton } from './ShapeToolButton';
import { TOOL_HOTKEYS } from './toolHotkeys';
import { UtilityToolButton } from './UtilityToolButton';

/** The tools that keep a button of their own: the two flyouts carry the rest. */
type IconTool = Exclude<PlanTool, ShapeTool | typeof PLACED_OBJECT_TOOL>;

interface ToolDescriptor {
  readonly tool: IconTool;
  readonly icon: LucideIcon;
  readonly label: string;
}

/**
 * The rail, in the order it is read. A tool with variants stands as one flyout
 * button rather than as one button per variant, and the two editors — the site
 * and the building — stand as doors right in the rail, so nothing worth doing
 * hides behind a panel alone.
 */
type PaletteEntry =
  | { readonly kind: 'tool'; readonly descriptor: ToolDescriptor }
  | { readonly kind: 'shape-flyout' }
  | { readonly kind: 'placed-object-flyout' }
  | { readonly kind: 'utility-flyout' }
  | { readonly kind: 'site-editor' }
  | { readonly kind: 'house-editor' };

const PALETTE: readonly PaletteEntry[] = [
  {
    kind: 'tool',
    descriptor: { tool: 'select', icon: MousePointer2, label: sitePlannerT.tools.select },
  },
  { kind: 'tool', descriptor: { tool: 'pan', icon: Hand, label: sitePlannerT.tools.pan } },
  { kind: 'site-editor' },
  { kind: 'house-editor' },
  { kind: 'shape-flyout' },
  {
    kind: 'tool',
    descriptor: { tool: 'elevation', icon: Flag, label: sitePlannerT.tools.elevation },
  },
  { kind: 'placed-object-flyout' },
  { kind: 'tool', descriptor: { tool: 'path', icon: Route, label: sitePlannerT.tools.path } },
  { kind: 'utility-flyout' },
  { kind: 'tool', descriptor: { tool: 'measure', icon: Ruler, label: sitePlannerT.tools.measure } },
];

const ToolButton = memo(
  ({
    descriptor,
    isActive,
    tooltipPlacement,
    onSelect,
  }: {
    readonly descriptor: ToolDescriptor;
    readonly isActive: boolean;
    readonly tooltipPlacement: FlyoutSide;
    readonly onSelect: (tool: PlanTool) => void;
  }) => {
    const { icon: Icon, label } = descriptor;
    const handleClick = useFunction(() => onSelect(descriptor.tool));
    const title = `${label} (${TOOL_HOTKEYS[descriptor.tool]})`;

    return (
      <Tooltip title={title} placement={tooltipPlacement}>
        <button
          type="button"
          aria-label={title}
          aria-pressed={isActive}
          onClick={handleClick}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            isActive
              ? 'bg-brand-500 text-white'
              : 'text-text-secondary hover:bg-white/10 hover:text-text'
          )}
        >
          <Icon size={TOOL_ICON_SIZE_PX} aria-hidden />
        </button>
      </Tooltip>
    );
  }
);

const PaletteButton = observer(
  ({
    entry,
    store,
    side,
  }: {
    readonly entry: PaletteEntry;
    readonly store: SitePlannerStore;
    readonly side: FlyoutSide;
  }) => {
    switch (entry.kind) {
      case 'tool':
        return (
          <ToolButton
            descriptor={entry.descriptor}
            isActive={entry.descriptor.tool === store.activeTool}
            tooltipPlacement={side}
            onSelect={store.setActiveTool}
          />
        );
      case 'shape-flyout':
        return <ShapeToolButton store={store} side={side} />;
      case 'placed-object-flyout':
        return <PlacedObjectToolButton store={store} side={side} />;
      case 'utility-flyout':
        return <UtilityToolButton store={store} side={side} />;
      case 'site-editor':
        return <SiteEditorButton store={store} side={side} />;
      case 'house-editor':
        return <HouseEditorButton store={store} side={side} />;
      default:
        return assertNever(entry);
    }
  }
);

/**
 * The rail's door into site editing. It reads as a tool — lit while its editor
 * is open — and a second press steps back out, so the rail alone can walk the
 * whole mode round trip.
 */
const SiteEditorButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const isActive = isSiteEditMode(store.editorMode) && !store.isEditingBuilding;

    const handleToggle = useFunction(() => {
      if (store.isEditingBuilding) {
        // The editor stays open — the aim just moves from the house to the plot.
        store.setActiveGroup('boundary');
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

/** The building's door: the same site editor, opened aimed at the house group. */
const HouseEditorButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const isActive = store.isEditingBuilding;

    const handleToggle = useFunction(() => {
      if (store.isEditingBuilding) {
        store.exitEditMode();
      } else {
        store.enterBuildingEditing(sitePlannerT.structure.house);
      }
    });

    return (
      <Tooltip title={sitePlannerT.modes.editHouse} placement={side}>
        <button
          type="button"
          aria-label={sitePlannerT.modes.editHouse}
          aria-pressed={isActive}
          onClick={handleToggle}
          className={railButtonClass(isActive)}
        >
          <Home size={TOOL_ICON_SIZE_PX} aria-hidden />
        </button>
      </Tooltip>
    );
  }
);

/**
 * A tool the open editor contributed (`OBJECT_EDITOR_SPECS`), rendered from
 * its presentation registry entry. Unregistered means invisible — the
 * contributing editor's own test keeps the two tables in step.
 */
const EditorToolButton = observer(
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

/** The tools the open editor contributes to the rail, after the shared ones. */
function editorOwnTools(mode: EditorMode): readonly EditorToolSpec[] {
  return mode.kind === 'edit' ? OBJECT_EDITOR_SPECS[mode.target.kind].ownTools : [];
}

function railButtonClass(isActive: boolean): string {
  return cn(
    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
    isActive ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-white/10 hover:text-text'
  );
}

/** Names an entry for React, since only the plain tools carry a tool name. */
function paletteEntryKey(entry: PaletteEntry): string {
  return entry.kind === 'tool' ? entry.descriptor.tool : entry.kind;
}

/**
 * Whether the mode shows an entry: tools follow the mode's tool table, while
 * the two editor doors stand in every mode — they ARE the mode switch.
 */
function isEntryVisible(entry: PaletteEntry, allowedTools: readonly PlanTool[]): boolean {
  switch (entry.kind) {
    case 'tool':
      return allowedTools.includes(entry.descriptor.tool);
    case 'shape-flyout':
      return allowedTools.includes('rectangle');
    case 'placed-object-flyout':
      return allowedTools.includes('tree');
    case 'utility-flyout':
      return allowedTools.includes('utility');
    case 'site-editor':
    case 'house-editor':
      return true;
    default:
      return assertNever(entry);
  }
}

/**
 * The tool strip; the hotkeys it advertises are handled by the plan input layer.
 * It stands beside the canvas on a wide screen and lies over it on a narrow one,
 * where a column of buttons would cost the plan a third of its width — which is
 * also why the tools with variants are flyouts rather than a button apiece.
 */
export const ToolPalette = observer(
  ({
    store,
    orientation = 'vertical',
  }: {
    readonly store: SitePlannerStore;
    readonly orientation?: 'vertical' | 'horizontal';
  }) => {
    const isHorizontal = orientation === 'horizontal';
    const allowedTools = allowedPlanTools(store.editorMode);

    return (
      <nav
        aria-label={sitePlannerT.tools.groupLabel}
        className={cn(
          'flex shrink-0 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1.5',
          isHorizontal ? 'flex-row overflow-x-auto' : 'flex-col'
        )}
      >
        {PALETTE.filter(entry => isEntryVisible(entry, allowedTools)).map(entry => (
          <PaletteButton
            key={paletteEntryKey(entry)}
            entry={entry}
            store={store}
            side={isHorizontal ? 'bottom' : 'right'}
          />
        ))}
        {editorOwnTools(store.editorMode).map(spec => (
          <EditorToolButton
            key={spec.id}
            spec={spec}
            store={store}
            side={isHorizontal ? 'bottom' : 'right'}
          />
        ))}
      </nav>
    );
  }
);
