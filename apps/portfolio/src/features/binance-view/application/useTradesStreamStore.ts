import type { TradesStreamStore } from './TradesStreamStore';
import { useBinanceViewStore } from './useBinanceViewStore';

/**
 * Hook returning the (possibly undefined) trades sub-store. Useful for
 * components that read trades-specific reactive state without needing
 * the full orchestrator. Returns `undefined` before `attachCanvas` has
 * run.
 */
export function useTradesStreamStore(): TradesStreamStore | undefined {
  const store = useBinanceViewStore();
  return store.tradesStore;
}
