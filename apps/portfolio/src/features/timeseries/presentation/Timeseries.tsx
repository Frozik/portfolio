import { memo } from 'react';

import commonStyles from '../../styles.module.scss';
import { CHART_ZOOM_LEVELS, GLOBAL_EPOCH_OFFSET } from '../domain/constants';
import { SharedRendererProvider } from './SharedRendererContext';
import { TimeseriesChart } from './TimeseriesChart';

export const Timeseries = memo(() => {
  return (
    <SharedRendererProvider>
      <div className={`${commonStyles.fixedContainer} grid grid-cols-2 grid-rows-2`}>
        {CHART_ZOOM_LEVELS.map(level => (
          <TimeseriesChart
            key={`${level[0]}-${level[1]}`}
            initialTimeStart={GLOBAL_EPOCH_OFFSET + level[0]}
            initialTimeEnd={GLOBAL_EPOCH_OFFSET + level[1]}
          />
        ))}
      </div>
    </SharedRendererProvider>
  );
});
