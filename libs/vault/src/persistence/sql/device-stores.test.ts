import { createNodeSqliteDriver } from '@frozik/utils/sql/testing/node-sqlite-driver';

import { describeDeviceStoresContract } from '../../testing/device-stores-contract';
import { createSqlDeviceStores } from './device-stores';

describeDeviceStoresContract('sql', () => {
  const driver = createNodeSqliteDriver();
  return random => createSqlDeviceStores(driver, random);
});
