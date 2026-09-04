import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { BINANCE_CONFIG } from '../domain/config';
import { openBinanceDbWithQuotaRecovery } from '../infrastructure/binance-indexeddb-recovery';
import { createBinanceInstrumentCatalog } from '../infrastructure/binance-instrument-catalog';
import { createBinanceChartRenderer } from '../infrastructure/render/chart-renderer';
import { ViewportController } from '../infrastructure/viewport-controller';
import { BinanceViewStore } from './BinanceViewStore';

const BINANCE_VIEW_STORE_KEY = 'binance-view';

/** Composition root: the store receives its IndexedDB, WebGPU and viewport adapters here. */
export function useBinanceViewStore(): BinanceViewStore {
  const rootStore = useRootStore();

  const store = rootStore.getOrCreateFeatureStore(
    BINANCE_VIEW_STORE_KEY,
    () =>
      new BinanceViewStore({
        openDb: openBinanceDbWithQuotaRecovery,
        instrumentCatalog: createBinanceInstrumentCatalog(BINANCE_CONFIG.apiHost),
        createRenderer: createBinanceChartRenderer,
        createViewportController: params => new ViewportController(params),
      })
  );

  useRefcountedFeatureStore(rootStore, BINANCE_VIEW_STORE_KEY);

  return store;
}
