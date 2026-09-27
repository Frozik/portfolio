import type { TDisplayRow } from './display-row';

export interface IPipelineStage<TRow> {
  readonly order: number;
  apply(rows: readonly TDisplayRow<TRow>[]): readonly TDisplayRow<TRow>[];
}

export function runPipeline<TRow>(
  stages: readonly IPipelineStage<TRow>[],
  rows: readonly TDisplayRow<TRow>[]
): readonly TDisplayRow<TRow>[] {
  return stages.reduce((current, stage) => stage.apply(current), rows);
}

export function orderStages<TRow>(
  stages: readonly IPipelineStage<TRow>[]
): readonly IPipelineStage<TRow>[] {
  return [...stages].sort((left, right) => left.order - right.order);
}
