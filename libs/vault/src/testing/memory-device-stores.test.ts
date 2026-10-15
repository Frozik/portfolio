import { describeDeviceStoresContract } from './device-stores-contract';
import { createMemoryDevice } from './memory-device-stores';

describeDeviceStoresContract('memory', createMemoryDevice);
