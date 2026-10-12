import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { when } from 'mobx';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';

import { aDevice, TEST_PASSWORD } from '../application/fake-device.test-helper';
import type { VaultFeatureStore } from '../application/VaultFeatureStore';
import { VaultStart } from './VaultStart';

function renderStart(store: VaultFeatureStore) {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={store} />}>
          <Route index element={<VaultStart />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('VaultStart', () => {
  it('shows a vault created with a description with it under the name', async () => {
    const store = aDevice().startStore();
    store.create('Home', TEST_PASSWORD, 'Shared with the kids');
    await when(() => store.session !== null);
    await store.registry.refresh();

    renderStart(store);

    const home = screen.getByRole('link', { name: /Home/ });
    expect(within(home).getByTestId('vault-description').textContent).toBe('Shared with the kids');
  });

  it('deletes a vault from this device only once the user confirms', async () => {
    const store = aDevice().startStore();
    store.create('Home', TEST_PASSWORD);
    await when(() => store.session !== null);
    store.lock('route-left');
    await store.registry.refresh();
    renderStart(store);

    fireEvent.click(screen.getByRole('button', { name: 'Delete “Home” from this device' }));
    expect(store.registry.vaults.value).toHaveLength(1);
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      await when(() => store.registry.vaults.value?.length === 0);
    });

    expect(screen.queryByRole('link', { name: /Home/ })).toBeNull();
  });
});
