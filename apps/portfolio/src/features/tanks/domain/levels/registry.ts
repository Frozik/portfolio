// Stage registry for the data derived from feichao93/battle-city (MIT — see
// LICENSE-upstream.txt).
import { assert } from '@frozik/utils/assert/assert';

import type { StageDefinition } from '../types';
import { STAGE_01 } from './stage-01';
import { STAGE_02 } from './stage-02';
import { STAGE_03 } from './stage-03';
import { STAGE_04 } from './stage-04';
import { STAGE_05 } from './stage-05';
import { STAGE_06 } from './stage-06';
import { STAGE_07 } from './stage-07';
import { STAGE_08 } from './stage-08';
import { STAGE_09 } from './stage-09';
import { STAGE_10 } from './stage-10';
import { STAGE_11 } from './stage-11';
import { STAGE_12 } from './stage-12';
import { STAGE_13 } from './stage-13';
import { STAGE_14 } from './stage-14';
import { STAGE_15 } from './stage-15';
import { STAGE_16 } from './stage-16';
import { STAGE_17 } from './stage-17';
import { STAGE_18 } from './stage-18';
import { STAGE_19 } from './stage-19';
import { STAGE_20 } from './stage-20';
import { STAGE_21 } from './stage-21';
import { STAGE_22 } from './stage-22';
import { STAGE_23 } from './stage-23';
import { STAGE_24 } from './stage-24';
import { STAGE_25 } from './stage-25';
import { STAGE_26 } from './stage-26';
import { STAGE_27 } from './stage-27';
import { STAGE_28 } from './stage-28';
import { STAGE_29 } from './stage-29';
import { STAGE_30 } from './stage-30';
import { STAGE_31 } from './stage-31';
import { STAGE_32 } from './stage-32';
import { STAGE_33 } from './stage-33';
import { STAGE_34 } from './stage-34';
import { STAGE_35 } from './stage-35';

export const STAGES: readonly StageDefinition[] = [
  STAGE_01,
  STAGE_02,
  STAGE_03,
  STAGE_04,
  STAGE_05,
  STAGE_06,
  STAGE_07,
  STAGE_08,
  STAGE_09,
  STAGE_10,
  STAGE_11,
  STAGE_12,
  STAGE_13,
  STAGE_14,
  STAGE_15,
  STAGE_16,
  STAGE_17,
  STAGE_18,
  STAGE_19,
  STAGE_20,
  STAGE_21,
  STAGE_22,
  STAGE_23,
  STAGE_24,
  STAGE_25,
  STAGE_26,
  STAGE_27,
  STAGE_28,
  STAGE_29,
  STAGE_30,
  STAGE_31,
  STAGE_32,
  STAGE_33,
  STAGE_34,
  STAGE_35,
];

export function getStageByNumber(stageNumber: number): StageDefinition {
  const stage = STAGES.find(candidate => candidate.stageNumber === stageNumber);

  assert(stage !== undefined, `unknown stage number ${stageNumber}`);

  return stage;
}
