import RBush from 'rbush';

import type { IDataPart, ISpatialItem } from './types';

export function createSpatialIndex(): RBush<ISpatialItem> {
  return new RBush<ISpatialItem>();
}

export function insertPart(tree: RBush<ISpatialItem>, part: IDataPart): void {
  tree.insert({
    minX: part.timeStart,
    minY: part.scale,
    maxX: part.timeEnd,
    maxY: part.scale,
    part,
  });
}

export function queryVisibleParts(
  tree: RBush<ISpatialItem>,
  scale: number,
  timeStart: number,
  timeEnd: number
): ISpatialItem[] {
  return tree.search({
    minX: timeStart,
    minY: scale,
    maxX: timeEnd,
    maxY: scale,
  });
}
