import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  BrickWall,
  Cable,
  Columns2,
  DoorOpen,
  Flame,
  Footprints,
  Layers2,
  Square,
  Wind,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import type { EditorToolId, EditTargetKind } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { ElectricToolButton } from './ElectricToolButton';
import { FireplaceToolButton } from './FireplaceToolButton';
import type { FlyoutSide } from './FlyoutToolButton';
import { FurnitureToolButton } from './FurnitureToolButton';
import { OpeningToolButton } from './OpeningToolButton';
import { SlabToolButton } from './SlabToolButton';
import { StairToolButton } from './StairToolButton';
import { StoreySwitcher } from './StoreySwitcher';

/**
 * The presentation half of `OBJECT_EDITOR_SPECS` (see `object-editors.md`):
 * how an editor-contributed tool looks and reads. The domain table says a tool
 * exists and what key arms it; this registry says which icon stands for it in
 * the rail and what the status bar explains while it is in hand. A tool
 * missing here simply does not render — the registration test of the editor
 * that contributes it is what keeps the two tables in step.
 */
export interface EditorToolPresentation {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint: string;
  /**
   * A tool with variants renders as this flyout instead of a plain button —
   * the corner-arrow pattern the shape and object tools set.
   */
  readonly Flyout?: ComponentType<{
    readonly store: SitePlannerStore;
    readonly side: FlyoutSide;
  }>;
}

export const EDITOR_TOOL_PRESENTATIONS: Partial<Record<EditorToolId, EditorToolPresentation>> = {
  'building:slab': {
    icon: Square,
    label: sitePlannerT.slabs.toolLabel,
    hint: sitePlannerT.slabs.toolHint,
    Flyout: SlabToolButton,
  },
  'building:wall': {
    icon: BrickWall,
    label: sitePlannerT.walls.toolLabel,
    hint: sitePlannerT.walls.toolHint,
  },
  'building:opening': {
    icon: DoorOpen,
    label: sitePlannerT.openings.toolLabel,
    hint: sitePlannerT.openings.toolHint,
    Flyout: OpeningToolButton,
  },
  'building:furniture': {
    icon: Armchair,
    label: sitePlannerT.furniture.toolLabel,
    hint: sitePlannerT.furniture.toolHint,
    Flyout: FurnitureToolButton,
  },
  'building:stair': {
    icon: Footprints,
    label: sitePlannerT.stairs.toolLabel,
    hint: sitePlannerT.stairs.toolHint,
    Flyout: StairToolButton,
  },
  'building:support': {
    icon: Columns2,
    label: sitePlannerT.supports.toolLabel,
    hint: sitePlannerT.supports.toolHint,
  },
  'building:fireplace': {
    icon: Flame,
    label: sitePlannerT.heating.toolLabel,
    hint: sitePlannerT.heating.toolHint,
    Flyout: FireplaceToolButton,
  },
  'building:duct': {
    icon: Wind,
    label: sitePlannerT.ventilation.toolLabel,
    hint: sitePlannerT.ventilation.toolHint,
  },
  'building:electric': {
    icon: Zap,
    label: sitePlannerT.electrical.toolLabel,
    hint: sitePlannerT.electrical.toolHint,
    Flyout: ElectricToolButton,
  },
  'building:connect': {
    icon: Cable,
    label: sitePlannerT.electrical.connectLabel,
    hint: sitePlannerT.electrical.connectHint,
  },
};

/**
 * How each building layer looks and reads (`layers.md` §8.2). A layer wears
 * the glyph of its main tool, so it is recognised by the sign already learnt.
 */
export const LAYER_PRESENTATIONS: Readonly<
  Record<BuildingLayerId, { readonly icon: LucideIcon; readonly label: string }>
> = {
  structure: { icon: Layers2, label: sitePlannerT.layers.names.structure },
  walls: { icon: BrickWall, label: sitePlannerT.layers.names.walls },
  furniture: { icon: Armchair, label: sitePlannerT.layers.names.furniture },
  electrical: { icon: Zap, label: sitePlannerT.layers.names.electrical },
  services: { icon: Wind, label: sitePlannerT.layers.names.services },
};

/**
 * What an editor adds next to the mode chip's exit button — the building
 * editor's storey switcher will be the first occupant.
 */
export const MODE_BAR_EXTRAS: Partial<
  Record<EditTargetKind, ComponentType<{ readonly store: SitePlannerStore }>>
> = {
  building: StoreySwitcher,
};
