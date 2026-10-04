import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import { BugReporterDemoStore } from './BugReporterDemoStore';

const BUG_REPORTER_DEMO_STORE_KEY = 'bug-reporter-demo';

export function useBugReporterDemoStore(): BugReporterDemoStore {
  const rootStore = useRootStore();
  const store = rootStore.getOrCreateFeatureStore(
    BUG_REPORTER_DEMO_STORE_KEY,
    () => new BugReporterDemoStore()
  );
  useRefcountedFeatureStore(rootStore, BUG_REPORTER_DEMO_STORE_KEY);
  return store;
}
