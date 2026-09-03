import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { sitePlannerT } from '../translations';
import {
  ElectricToolProperties,
  OpeningToolProperties,
  SelectedDeviceProperties,
  SelectedFurnitureProperties,
  SelectedOpeningProperties,
} from './OpeningDeviceProperties';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { SelectedGroupProperties, SelectedShapeProperties } from './ShapeProperties';
import {
  SelectedCarProperties,
  SelectedMarkProperties,
  SelectedPathProperties,
  SelectedTreeProperties,
} from './SiteObjectProperties';
import { SelectedUtilityRouteProperties, UtilityToolProperties } from './UtilityRouteProperties';
import {
  SelectedBuildingProperties,
  SelectedWallProperties,
  WallToolProperties,
} from './WallBuildingProperties';

/**
 * What the tool in hand is set to, when it has settings of its own: the
 * opening's preset, the device kind, the trench's system. It is its own panel
 * so it can stand at the TOP of the column — options for the tool being used
 * are not «properties of the selection», and burying them under the other
 * panels made the opening presets look as if they had been removed.
 */
export const ToolOptionsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const options = toolOptionsFor(store);

  if (isNil(options)) {
    return null;
  }

  return <PlannerPanel title={sitePlannerT.properties.toolTitle}>{options}</PlannerPanel>;
});

function toolOptionsFor(store: SitePlannerStore): ReactNode {
  switch (store.activeTool) {
    case 'building:wall':
      return <WallToolProperties store={store} />;
    case 'building:opening':
      return <OpeningToolProperties store={store} />;
    case 'building:electric':
      return <ElectricToolProperties store={store} />;
    case 'building:connect':
      return <PanelHint>{sitePlannerT.electrical.connectHint}</PanelHint>;
    case 'utility':
      return isNil(store.utilities.selectedUtilityRoute) ? (
        <UtilityToolProperties store={store} />
      ) : undefined;
    default:
      return undefined;
  }
}

/**
 * The keyboard path of R20: exact numbers for whatever the canvas has selected.
 */
const SelectionProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { selectedGroupTerm } = store.composition;
  const { selectedMark, selectedTree, selectedCar, selectedPath } = store.siteObjects;
  const { selectedBuilding } = store.building;
  const { selectedWall, selectedOpening } = store.walls;
  const { selectedFurniture, selectedDevice } = store.storeyObjects;
  const { selectedUtilityRoute } = store.utilities;

  if (!isNil(selectedDevice)) {
    return <SelectedDeviceProperties store={store} device={selectedDevice} />;
  }

  if (!isNil(selectedUtilityRoute)) {
    return <SelectedUtilityRouteProperties store={store} route={selectedUtilityRoute} />;
  }

  if (!isNil(selectedFurniture)) {
    return <SelectedFurnitureProperties store={store} furniture={selectedFurniture} />;
  }

  if (!isNil(selectedOpening)) {
    return <SelectedOpeningProperties store={store} opening={selectedOpening} />;
  }

  if (!isNil(selectedWall)) {
    return <SelectedWallProperties store={store} wall={selectedWall} />;
  }

  if (!isNil(selectedBuilding)) {
    return <SelectedBuildingProperties store={store} building={selectedBuilding} />;
  }

  if (!isNil(selectedMark)) {
    return <SelectedMarkProperties store={store} mark={selectedMark} />;
  }

  if (!isNil(selectedTree)) {
    return <SelectedTreeProperties store={store} tree={selectedTree} />;
  }

  if (!isNil(selectedCar)) {
    return <SelectedCarProperties store={store} car={selectedCar} />;
  }

  if (!isNil(selectedPath)) {
    return <SelectedPathProperties store={store} path={selectedPath} />;
  }

  if (!isNil(selectedGroupTerm)) {
    return <SelectedGroupProperties store={store} groupTerm={selectedGroupTerm} />;
  }

  // Shapes last: with nothing selected at all, this is what shows the hint for
  // the tool in hand.
  return <SelectedShapeProperties store={store} />;
});

export const PropertiesPanel = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <PlannerPanel title={sitePlannerT.properties.title}>
    <SelectionProperties store={store} />
  </PlannerPanel>
));
