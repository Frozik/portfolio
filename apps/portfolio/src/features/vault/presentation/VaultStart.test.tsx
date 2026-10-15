import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { when } from 'mobx';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';
import { VaultStart } from './VaultStart';

function renderStart(store: VaultApp) {
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

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

/** The start's routes as the app declares them, beginning at the given address. */
function renderStartAt(store: VaultApp, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="vault" element={<Outlet context={store} />}>
          <Route index element={<VaultStart />} />
          <Route path="new" element={<VaultStart />} />
          <Route path="open/*" element={<VaultStart />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function where(): string | null {
  return screen.getByTestId('where').textContent;
}

describe('VaultStart', () => {
  it('opens the new vault’s form at an address of its own, and its Cancel steps back', async () => {
    const store = aDevice().startStore();
    renderStartAt(store, '/vault');

    act(() => fireEvent.click(screen.getByRole('link', { name: 'Create a vault' })));
    expect(where()).toBe('/vault/new');
    expect(screen.getByLabelText('Vault name')).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));

    expect(where()).toBe('/vault');
    expect(store.createForm).toBeNull();
  });

  it('opens the cloud at an address of its own, the form reached directly leaving for the start', () => {
    const store = aDevice().startStore();
    renderStartAt(store, '/vault/open');

    expect(screen.getByTestId('wizard-steps')).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Close' })));

    expect(where()).toBe('/vault');
  });

  it('sends a new vault for a cloud folder back to the cloud while no folder is reached', () => {
    const store = aDevice().startStore();
    renderStartAt(store, '/vault/open/new');

    expect(where()).toBe('/vault/open');
  });

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
    store.lock('left');
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
