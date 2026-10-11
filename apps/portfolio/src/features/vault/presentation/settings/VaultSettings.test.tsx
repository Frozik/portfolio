import { assert } from '@frozik/utils/assert/assert';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { when } from 'mobx';
import { MemoryRouter } from 'react-router-dom';

import { aDevice } from '../../application/fake-device.test-helper';
import type { VaultSession } from '../../application/VaultSession';
import { VaultSettings } from './VaultSettings';

async function settingsOf() {
  const store = aDevice().startStore();
  store.startDemo('Demo', key => key);
  await when(() => (store.session?.document.cards.size ?? 0) > 0);
  const session: VaultSession | null = store.session;
  assert(session !== null);
  const onForget = vi.fn();
  render(
    <MemoryRouter>
      <VaultSettings
        session={session}
        backTo="/vault"
        cloud={null}
        data={null}
        recovery={null}
        onRename={vi.fn()}
        onForget={onForget}
      />
    </MemoryRouter>
  );
  return { session, onForget };
}

describe('VaultSettings', () => {
  it('locks sooner once a shorter idle time is chosen', async () => {
    const { session } = await settingsOf();

    act(() => fireEvent.click(screen.getByRole('combobox', { name: 'Lock after inactivity' })));
    act(() => fireEvent.click(screen.getByRole('option', { name: '1 minute' })));

    expect(session.deviceSettings.settings.lock.idle).toBe(60_000);
  });

  it('deletes the vault from the device only after asking', async () => {
    const { onForget } = await settingsOf();

    act(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Delete this vault from this device' }))
    );
    expect(onForget).not.toHaveBeenCalled();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));

    expect(onForget).toHaveBeenCalledOnce();
  });
});
