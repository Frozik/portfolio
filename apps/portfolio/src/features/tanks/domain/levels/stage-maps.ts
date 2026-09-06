// Stage data derived from the upstream feichao93/battle-city stage JSONs (MIT — see
// LICENSE-upstream.txt). One character per 8-wu cell, 26 rows per stage; see `stage-format.ts`
// for the legend and the parser.
import type { StageMapSource } from './stage-format';
import { STAGES_1_TO_12 } from './stages-01-12';
import { STAGES_13_TO_24 } from './stages-13-24';
import { STAGES_25_TO_35 } from './stages-25-35';

export const STAGE_MAP_SOURCES: readonly StageMapSource[] = [
  ...STAGES_1_TO_12,
  ...STAGES_13_TO_24,
  ...STAGES_25_TO_35,
];
