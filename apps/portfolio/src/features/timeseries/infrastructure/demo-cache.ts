import { indexedDbCache } from '@frozik/charts/dom/indexeddb-cache';
import { reportError } from '@frozik/utils/diagnostics/reportError';

/**
 * What the overview has read stays on disk: opened again, the page shows its
 * history at once and asks the sources only for what it has not seen. The
 * database is opened on the first read, not here.
 */
export const demoCache = indexedDbCache({
  name: 'frozik-charts-demo',
  version: 1,
  onFailure: error => reportError('timeseries: the IndexedDB cache is off', error),
});
