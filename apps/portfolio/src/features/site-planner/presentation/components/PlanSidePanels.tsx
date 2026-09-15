import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';
import { useState } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import { DEFAULT_BUILDING_LAYER } from '../../domain/model/building-layers';
import type { EditTargetKind } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { ElectricalPanel } from './ElectricalPanel';
import { ElevationMarksPanel } from './ElevationMarksPanel';
import { EntriesPanel } from './EntriesPanel';
import { FurniturePanel } from './FurniturePanel';
import { HeatingPanel } from './HeatingPanel';
import { BuildingsPanel } from './HousePanel';
import { LayersPanel } from './LayersPanel';
import { ObjectsPanel } from './ObjectsPanel';
import { PanelGroup } from './PanelGroup';
import { PathSegmentsPanel } from './PathSegmentsPanel';
import { hasToolOptions, PropertiesPanel, ToolOptionsPanel } from './PropertiesPanel';
import { RoofPanel } from './RoofPanel';
import { RoomsPanel } from './RoomsPanel';
import { SiteCard } from './SiteCard';
import { SlabsPanel } from './SlabsPanel';
import { StairsPanel } from './StairsPanel';
import { StoreyPanel } from './StoreyPanel';
import { StructurePanel } from './StructurePanel';
import { SupportsPanel } from './SupportsPanel';
import { UtilitiesPanel } from './UtilitiesPanel';
import { VentilationPanel } from './VentilationPanel';
import { WallsPanel } from './WallsPanel';
import { WarningsPanel } from './WarningsPanel';

type PanelComponent = ComponentType<{ readonly store: SitePlannerStore }>;

/** One run of panels under a heading that opens and closes. */
interface PanelSection {
  readonly title: string;
  readonly panels: readonly PanelComponent[];
  /**
   * Left out, the group always shows. A group whose every panel can come back
   * empty names the same predicate its panels decide by — a standing heading
   * over nothing reads as something gone missing.
   */
  readonly isVisible?: (store: SitePlannerStore) => boolean;
}

const TOOL_SECTION: PanelSection = {
  title: sitePlannerT.panelGroups.tool,
  panels: [ToolOptionsPanel],
  isVisible: hasToolOptions,
};
const PROPERTIES_SECTION: PanelSection = {
  title: sitePlannerT.panelGroups.properties,
  panels: [PropertiesPanel],
};

/**
 * Which panels each mode shows, in reading order — the panel half of the
 * object-editor registry (`object-editors.md`): a future editor contributes
 * its column as one more row here, never as another branch.
 *
 * The rows are grouped by the job in hand (R27): what is being built, what is
 * being put inside it, what is being run through it. The column used to stand
 * every panel open at once — eight cards deep in the building editor — so the
 * one being worked in was usually below the fold.
 */
const VIEW_SECTIONS: readonly PanelSection[] = [
  TOOL_SECTION,
  { title: sitePlannerT.panelGroups.plot, panels: [ObjectsPanel, SiteCard, UtilitiesPanel] },
  PROPERTIES_SECTION,
];

/**
 * The building editor's column follows its active layer (`layers.md` §6.6):
 * the layers card, the storey, the findings and the properties stand
 * whatever the layer, and between them come the panels of the layer alone —
 * the walls' column has no furniture list to scroll past.
 */
const LAYER_SECTIONS: Readonly<Record<BuildingLayerId, PanelSection>> = {
  structure: {
    title: sitePlannerT.layers.names.structure,
    panels: [SlabsPanel, SupportsPanel, RoofPanel],
  },
  walls: {
    title: sitePlannerT.layers.names.walls,
    panels: [WallsPanel, RoomsPanel, StairsPanel],
  },
  furniture: { title: sitePlannerT.layers.names.furniture, panels: [FurniturePanel] },
  electrical: { title: sitePlannerT.layers.names.electrical, panels: [ElectricalPanel] },
  services: {
    title: sitePlannerT.layers.names.services,
    panels: [EntriesPanel, HeatingPanel, VentilationPanel],
  },
};

function buildingSections(activeLayer: BuildingLayerId): readonly PanelSection[] {
  return [
    TOOL_SECTION,
    { title: sitePlannerT.layers.panelTitle, panels: [LayersPanel] },
    { title: sitePlannerT.storeys.panelTitle, panels: [StoreyPanel] },
    { title: sitePlannerT.panelGroups.findings, panels: [WarningsPanel] },
    LAYER_SECTIONS[activeLayer],
    PROPERTIES_SECTION,
  ];
}

const EDITOR_SECTIONS: Readonly<
  Record<EditTargetKind, (store: SitePlannerStore) => readonly PanelSection[]>
> = {
  site: () => [
    TOOL_SECTION,
    {
      title: sitePlannerT.panelGroups.plot,
      panels: [StructurePanel, BuildingsPanel, ElevationMarksPanel],
    },
    PROPERTIES_SECTION,
  ],
  path: () => [
    { title: sitePlannerT.panelGroups.properties, panels: [PathSegmentsPanel, PropertiesPanel] },
  ],
  // Trench editing is when norm findings get fixed, so they stay in view.
  utilityRoute: () => [
    TOOL_SECTION,
    { title: sitePlannerT.panelGroups.services, panels: [UtilitiesPanel] },
    PROPERTIES_SECTION,
  ],
  building: store => buildingSections(store.layers.activeLayer ?? DEFAULT_BUILDING_LAYER),
};

/**
 * The editor's panels. A wide screen stands the column next to the canvas, a
 * narrow one puts it into a drawer — same panels either way.
 */
export const PlanSidePanels = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const mode = store.editorMode;
  const sections = mode.kind === 'edit' ? EDITOR_SECTIONS[mode.target.kind](store) : VIEW_SECTIONS;
  const [closedTitles, setClosedTitles] = useState<readonly string[]>([]);

  const handleToggle = useFunction((title: string) => {
    setClosedTitles(previous =>
      previous.includes(title)
        ? previous.filter(candidate => candidate !== title)
        : [...previous, title]
    );
  });

  return (
    <>
      {sections
        .filter(section => section.isVisible?.(store) ?? true)
        .map(section => (
          <PanelGroup
            key={section.title}
            title={section.title}
            isOpen={!closedTitles.includes(section.title)}
            onToggle={handleToggle}
          >
            {section.panels.map((Panel, index) => (
              // The list is a fixed table row: panels have no identity beyond their place.
              // oxlint-disable-next-line react/no-array-index-key -- static per-mode panel order
              <Panel key={index} store={store} />
            ))}
          </PanelGroup>
        ))}
    </>
  );
});
