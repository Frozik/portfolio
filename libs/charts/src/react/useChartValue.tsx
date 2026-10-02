import { useCallback, useSyncExternalStore } from 'react';

interface IFrameSource {
  on(event: 'frame.prepared', handler: VoidFunction): VoidFunction;
}

/**
 * A value read from a chart — a slice field, the viewport, the frame — kept
 * up to date: it is read again after every frame, and the component renders
 * only when it changed. Return primitives or objects the chart keeps stable.
 */
export function useChartValue<TChart extends IFrameSource, TValue>(
  chart: TChart,
  select: (chart: TChart) => TValue
): TValue {
  const subscribe = useCallback(
    (onChange: VoidFunction) => chart.on('frame.prepared', onChange),
    [chart]
  );
  const read = (): TValue => select(chart);
  return useSyncExternalStore(subscribe, read, read);
}
