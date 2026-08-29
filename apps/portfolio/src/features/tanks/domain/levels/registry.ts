// Stage registry for the data derived from feichao93/battle-city (MIT — see
// LICENSE-upstream.txt).
import { assert } from '@frozik/utils/assert/assert';

import type { StageDefinition } from '../types';
import { parseStageMap } from './stage-format';
import { STAGE_MAP_SOURCES } from './stage-maps';

export const STAGES: readonly StageDefinition[] = STAGE_MAP_SOURCES.map(source =>
  parseStageMap(source)
);

export function getStageByNumber(stageNumber: number): StageDefinition {
  const stage = STAGES.find(candidate => candidate.stageNumber === stageNumber);

  assert(stage !== undefined, `unknown stage number ${stageNumber}`);

  return stage;
}
