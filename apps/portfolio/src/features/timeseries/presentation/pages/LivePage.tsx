import { useChart } from '@frozik/charts/react/useChart';
import { useChartValue } from '@frozik/charts/react/useChartValue';
import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import type { TLiveStyle } from '../../application/charts/live-chart';
import { createLiveChart, LIVE_STYLES, PRICE_SERIES } from '../../application/charts/live-chart';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';
import { useDebugBlocks } from '../components/useDebugBlocks';
import { timeseriesT } from '../translations';

const STYLES: readonly TLiveStyle[] = ['line', 'stairs', 'area'];

export const LivePage = observer(() => {
  const store = useTimeseriesDemoStore();
  const chart = useChart(() => createLiveChart(store));
  const charts = useChart(() => [chart]);
  useDebugBlocks(charts, store.debug);
  const isFollowing = useChartValue(chart, live => live.followTail.isFollowing);
  const [style, setStyle] = useState<TLiveStyle>('line');

  const handleStyle = useEventCallback((next: TLiveStyle) => {
    setStyle(next);
    chart.series.setStyle(PRICE_SERIES, LIVE_STYLES[next]);
  });
  const handleResume = useEventCallback(() => chart.followTail.resume());

  return (
    <DemoStage>
      <div className="flex h-full w-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5 text-xs text-text-secondary">
          {STYLES.map(each => (
            <Button
              key={each}
              size="sm"
              variant={each === style ? 'secondary' : 'ghost'}
              onClick={() => handleStyle(each)}
            >
              {timeseriesT.live.styles[each]}
            </Button>
          ))}
          <span className={cn('ml-2', isFollowing && 'text-success')}>
            {isFollowing ? timeseriesT.live.following : timeseriesT.live.history}
          </span>
          <Button size="sm" variant="secondary" disabled={isFollowing} onClick={handleResume}>
            {timeseriesT.live.toLiveEdge}
          </Button>
        </div>
        <ExpandableChart model={chart} className="min-h-0 w-full flex-1" />
      </div>
    </DemoStage>
  );
});
