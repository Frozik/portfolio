import type { LucideIcon } from 'lucide-react';
import { Armchair, BrickWall, Cable, DoorOpen, Zap } from 'lucide-react';
import type { ComponentType } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { EditorToolId, EditTargetKind } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { ElectricToolButton } from './ElectricToolButton';
import type { FlyoutSide } from './FlyoutToolButton';
import { FurnitureToolButton } from './FurnitureToolButton';
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
  'building:wall': {
    icon: BrickWall,
    label: sitePlannerT.walls.toolLabel,
    hint: sitePlannerT.walls.toolHint,
  },
  'building:opening': {
    icon: DoorOpen,
    label: sitePlannerT.openings.toolLabel,
    hint: sitePlannerT.openings.toolHint,
  },
  'building:furniture': {
    icon: Armchair,
    label: sitePlannerT.furniture.toolLabel,
    hint: sitePlannerT.furniture.toolHint,
    Flyout: FurnitureToolButton,
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
 * What an editor adds next to the mode chip's exit button — the building
 * editor's storey switcher will be the first occupant.
 */
export const MODE_BAR_EXTRAS: Partial<
  Record<EditTargetKind, ComponentType<{ readonly store: SitePlannerStore }>>
> = {
  building: StoreySwitcher,
};
