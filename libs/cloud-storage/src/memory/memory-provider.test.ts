import { describeStorageProviderContract } from '../testing/storage-contract';
import { createMemoryProvider } from './memory-provider';

describeStorageProviderContract('memory', () => createMemoryProvider());
