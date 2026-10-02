import { memoryPersistentCache } from './memory-persistent-cache';
import { describePersistentCache } from './persistent-cache-contract';

describePersistentCache('memory', {
  create: memoryPersistentCache,
  settle: () => Promise.resolve(),
});
