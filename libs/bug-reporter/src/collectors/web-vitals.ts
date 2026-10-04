import type { IWebVital, TVitalName } from '../core/report';

interface IMetricWithAttribution {
  readonly name: TVitalName;
  readonly value: number;
  readonly rating: IWebVital['rating'];
  readonly attribution: object;
}

/**
 * web-vitals offers no unsubscribe, so the page subscribes once and every
 * collector reads the shared latest values; the library itself is loaded on
 * demand, being dead weight on a page that never opens the reporter.
 */
const latest = new Map<TVitalName, IWebVital>();
let subscription: Promise<void> | null = null;

export class WebVitalsCollector {
  constructor() {
    subscription ??= subscribe();
  }

  snapshot(): readonly IWebVital[] {
    return [...latest.values()];
  }
}

async function subscribe(): Promise<void> {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals/attribution');
  const report = (metric: IMetricWithAttribution) => latest.set(metric.name, toVital(metric));
  const options = { reportAllChanges: true };
  onCLS(report, options);
  onFCP(report, options);
  onINP(report, options);
  onLCP(report, options);
  onTTFB(report, options);
}

function toVital(metric: IMetricWithAttribution): IWebVital {
  const attribution: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(metric.attribution)) {
    if (typeof value === 'string' || typeof value === 'number') {
      attribution[key] = value;
    }
  }
  return { name: metric.name, value: metric.value, rating: metric.rating, attribution };
}
