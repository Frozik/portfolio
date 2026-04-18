import { useRootStore } from '../../../app/stores';
import { BinanceViewStore } from './BinanceViewStore';

export function useBinanceViewStore(): BinanceViewStore {
  return useRootStore().getOrCreateFeatureStore('binance-view', () => new BinanceViewStore());
}
