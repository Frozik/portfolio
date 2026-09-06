import type { Temporal } from 'temporal-polyfill';
import type { EParseTemporality } from './types';

/** What every parsing path hands back: the resolved instant with how sure and how tensed it is. */
export interface IPipelineResult {
  readonly value: Temporal.ZonedDateTime;
  readonly temporality: EParseTemporality;
}
