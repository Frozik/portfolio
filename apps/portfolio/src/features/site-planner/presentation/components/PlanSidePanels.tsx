import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { EditTargetKind } from '../../domain/model/editor-mode';
import { ElectricalPanel } from './ElectricalPanel';
import { ElevationMarksPanel } from './ElevationMarksPanel';
import { FurniturePanel } from './FurniturePanel';
import { BuildingsPanel } from './HousePanel';
import { PathSegmentsPanel } from './PathSegmentsPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { RoofPanel } from './RoofPanel';
import { RoomsPanel } from './RoomsPanel';
import { SiteCard } from './SiteCard';
import { ObjectsPanel, StructurePanel } from './StructurePanel';
import { UtilitiesPanel } from './UtilitiesPanel';
import { WallsPanel } from './WallsPanel';

type PanelComponent = ComponentType<{ readonly store: SitePlannerStore }>;

/**
 * Which panels each mode shows, in reading order — the panel half of the
 * object-editor registry (`object-editors.md`): a future editor contributes
 * its column as one more row here, never as another branch. Viewing shows the
 * objects and the door into site editing; site editing the ground plan's
 * anatomy; path editing nothing but the segments of what is being shaped.
 */
const VIEW_PANELS: readonly PanelComponent[] = [
  ObjectsPanel,
  SiteCard,
  UtilitiesPanel,
  PropertiesPanel,
];

const EDITOR_PANELS: Readonly<Record<EditTargetKind, readonly PanelComponent[]>> = {
  site: [StructurePanel, BuildingsPanel, ElevationMarksPanel, PropertiesPanel],
  path: [PathSegmentsPanel, PropertiesPanel],
  // Trench editing is when norm findings get fixed, so they stay in view.
  utilityRoute: [UtilitiesPanel, PropertiesPanel],
  building: [WallsPanel, FurniturePanel, ElectricalPanel, RoomsPanel, RoofPanel, PropertiesPanel],
};

/**
 * The editor's panels. A wide screen stands the column next to the canvas, a
 * narrow one puts it into a drawer — same panels either way.
 */
export const PlanSidePanels = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const mode = store.editorMode;
  const panels = mode.kind === 'edit' ? EDITOR_PANELS[mode.target.kind] : VIEW_PANELS;

  return (
    <>
      {panels.map((Panel, index) => (
        // The list is a fixed table row: panels have no identity beyond their place.
        // biome-ignore lint/suspicious/noArrayIndexKey: static per-mode panel order
        <Panel key={index} store={store} />
      ))}
    </>
  );
});
