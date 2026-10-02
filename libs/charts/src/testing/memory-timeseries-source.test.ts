import { TIME_SCALE } from '../data/timeseries/time-scale';
import { memorySource } from './memory-timeseries-source';
import { describeTimeseriesSource } from './timeseries-source-contract';

const SECOND = 1_000_000_000n;

/** Three elements at every fifth second: times that repeat are where a soft limit shows. */
const POINTS = Array.from({ length: 300 }, (_, index) => ({
  x: BigInt(Math.floor(index / 3) * 5) * SECOND,
  value: index,
}));

describeTimeseriesSource('memory source', {
  create: () => {
    const source = memorySource({ points: POINTS });
    const subscribe = source.subscribe.bind(source);
    source.subscribe = request => {
      const unsubscribe = subscribe(request);
      queueMicrotask(() => source.start(495n * SECOND));
      return unsubscribe;
    };
    return source;
  },
  from: 0n,
  to: 495n * SECOND,
  scale: TIME_SCALE.seconds5,
  shape: 'point',
  softLimit: 40,
});
