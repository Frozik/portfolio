import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { EntriesBlock } from './UtilityEntriesBlock';

/**
 * The building editor's ИНЖЕНЕРИЯ card for the utility entries: where each
 * external system arrives, and so where the indoor runs start from. The same
 * badges answer on the plan itself — clickable there, draggable along the
 * outline — this card is the list view and the place a new entry is added.
 */
export const EntriesPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.scene.buildingScenes.find(candidate => candidate.building.id === buildingId);

  if (isNil(scene)) {
    return null;
  }

  const labels = sitePlannerT.house.entries;

  return (
    <PlannerPanel title={labels.title}>
      <EntriesBlock store={store} scene={scene} />
      <PanelHint>{labels.editorHint}</PanelHint>
    </PlannerPanel>
  );
});
