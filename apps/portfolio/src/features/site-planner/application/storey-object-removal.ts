import { isNil } from 'lodash-es';
import type { BuildingId } from '../domain/model/building';
import type { SelectedStoreyObject } from '../domain/model/storey-object-selection';
import {
  selectedStoreyObject,
  storeyObjectSelector,
} from '../domain/model/storey-object-selection';
import type { StoreyObjectKey } from '../domain/model/storey-objects';
import type { PlanEditorCore } from './editor-core';

/**
 * Takes one storey object off its storey — whichever kind it is — and drops
 * any selection that named it. The kinds differ in what removal MEANS only
 * for a device, which is unwired as it goes; the table carries that
 * difference, so every caller is one line.
 */
export function takeStoreyObjectAway(
  core: PlanEditorCore,
  key: StoreyObjectKey,
  buildingId: BuildingId,
  id: string
): void {
  const selector = storeyObjectSelector(key);

  core.pushHistory();
  core.buildings = selector.remove(core.buildings, buildingId, id);
  dropSelectionsNaming(core, { selector, buildingId, id });
}

/** Drops whatever selection pointed at an object that has just left the plan. */
function dropSelectionsNaming(core: PlanEditorCore, selected: SelectedStoreyObject): void {
  core.selections = core.selections.filter(candidate => {
    const named = selectedStoreyObject(candidate);

    return (
      isNil(named) ||
      named.selector.key !== selected.selector.key ||
      named.id !== selected.id ||
      named.buildingId !== selected.buildingId
    );
  });
}
