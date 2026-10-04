import type { ChartModel } from '@frozik/charts/core/chart-model';
import { useCallback } from 'react';

import { useFeatureAgentTools } from '../../../../app/components/TopNavAgentToolsContext';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';

const NO_CHARTS: readonly ChartModel<number>[] = [];

/** Exposes the charts of the open page to WebMCP agents; pass the page's stable chart arrays. */
export function useTimeseriesAgentTools(
  timeCharts: readonly ChartModel<bigint>[],
  numberCharts: readonly ChartModel<number>[] = NO_CHARTS
): void {
  const store = useTimeseriesDemoStore();
  const loadTools = useCallback(
    () =>
      import('../../application/timeseries-agent-tools').then(module =>
        module.createTimeseriesAgentTools(store, timeCharts, numberCharts)
      ),
    [store, timeCharts, numberCharts]
  );
  useFeatureAgentTools(loadTools);
}
