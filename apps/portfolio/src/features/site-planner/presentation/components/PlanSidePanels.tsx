import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';
import { useState } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { EditTargetKind } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { ElectricalPanel } from './ElectricalPanel';
import { ElevationMarksPanel } from './ElevationMarksPanel';
import { EntriesPanel } from './EntriesPanel';
import { FurniturePanel } from './FurniturePanel';
import { HeatingPanel } from './HeatingPanel';
import { BuildingsPanel } from './HousePanel';
import { ObjectsPanel } from './ObjectsPanel';
import { PanelGroup } from './PanelGroup';
import { PathSegmentsPanel } from './PathSegmentsPanel';
import { PropertiesPanel, ToolOptionsPanel } from './PropertiesPanel';
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
}

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
  { title: sitePlannerT.panelGroups.tool, panels: [ToolOptionsPanel] },
  { title: sitePlannerT.panelGroups.plot, panels: [ObjectsPanel, SiteCard, UtilitiesPanel] },
  { title: sitePlannerT.panelGroups.properties, panels: [PropertiesPanel] },
];

const EDITOR_SECTIONS: Readonly<Record<EditTargetKind, readonly PanelSection[]>> = {
  site: [
    { title: sitePlannerT.panelGroups.tool, panels: [ToolOptionsPanel] },
    {
      title: sitePlannerT.panelGroups.plot,
      panels: [StructurePanel, BuildingsPanel, ElevationMarksPanel],
    },
    { title: sitePlannerT.panelGroups.properties, panels: [PropertiesPanel] },
  ],
  path: [
    { title: sitePlannerT.panelGroups.properties, panels: [PathSegmentsPanel, PropertiesPanel] },
  ],
  // Trench editing is when norm findings get fixed, so they stay in view.
  utilityRoute: [
    { title: sitePlannerT.panelGroups.tool, panels: [ToolOptionsPanel] },
    { title: sitePlannerT.panelGroups.services, panels: [UtilitiesPanel] },
    { title: sitePlannerT.panelGroups.properties, panels: [PropertiesPanel] },
  ],
  building: [
    { title: sitePlannerT.panelGroups.tool, panels: [ToolOptionsPanel] },
    { title: sitePlannerT.panelGroups.findings, panels: [WarningsPanel] },
    {
      title: sitePlannerT.panelGroups.structure,
      panels: [StoreyPanel, SlabsPanel, WallsPanel, StairsPanel, SupportsPanel, RoofPanel],
    },
    { title: sitePlannerT.panelGroups.interior, panels: [FurniturePanel, RoomsPanel] },
    {
      title: sitePlannerT.panelGroups.services,
      panels: [EntriesPanel, HeatingPanel, VentilationPanel, ElectricalPanel],
    },
    { title: sitePlannerT.panelGroups.properties, panels: [PropertiesPanel] },
  ],
};

/**
 * The editor's panels. A wide screen stands the column next to the canvas, a
 * narrow one puts it into a drawer — same panels either way.
 */
export const PlanSidePanels = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const mode = store.editorMode;
  const sections = mode.kind === 'edit' ? EDITOR_SECTIONS[mode.target.kind] : VIEW_SECTIONS;
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
      {sections.map(section => (
        <PanelGroup
          key={section.title}
          title={section.title}
          isOpen={!closedTitles.includes(section.title)}
          onToggle={handleToggle}
        >
          {section.panels.map((Panel, index) => (
            // The list is a fixed table row: panels have no identity beyond their place.
            // biome-ignore lint/suspicious/noArrayIndexKey: static per-mode panel order
            <Panel key={index} store={store} />
          ))}
        </PanelGroup>
      ))}
    </>
  );
});
