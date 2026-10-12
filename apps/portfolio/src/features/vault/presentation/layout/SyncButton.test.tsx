import { assert } from '@frozik/utils/assert/assert';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { when } from 'mobx';

import { aDevice, linkedToWebDav, TEST_PASSWORD } from '../../application/fake-device.test-helper';
import { SyncButton } from './SyncButton';

describe('SyncButton', () => {
  it('syncs a vault kept in a cloud on request', async () => {
    const { store } = await linkedToWebDav();
    const cloud = store.session?.cloud;
    assert(cloud !== undefined);
    render(<SyncButton cloud={cloud} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Sync' })));

    await when(() => cloud.status.kind === 'synced');
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy();
  });

  it('is not there for a vault on this device only', async () => {
    const store = aDevice().startStore();
    store.create('Home', TEST_PASSWORD);
    await when(() => store.session !== null);
    const cloud = store.session?.cloud;
    assert(cloud !== undefined);

    render(<SyncButton cloud={cloud} />);

    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
  });
});
