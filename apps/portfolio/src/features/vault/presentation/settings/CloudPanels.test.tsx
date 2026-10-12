import { act, fireEvent, render, screen } from '@testing-library/react';

import { aDevice, TEST_FOLDER } from '../../application/fake-device.test-helper';
import { CloudPanels } from './CloudPanels';

function renderWizard(onCreate = vi.fn()) {
  const { cloud } = aDevice().startStore();
  render(
    <CloudPanels
      cloud={cloud}
      driveAction={{ kind: 'open', onOpen: vi.fn(), onCreate }}
      webDavAction={{ kind: 'open', onOpen: vi.fn(), onCreate }}
    />
  );
  return cloud;
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name });

describe('CloudPanels', () => {
  it('shows only the chosen cloud, and goes back to the choice', () => {
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive…' }));
    expect(button('Connect a WebDAV folder…')).toBeNull();
    expect(screen.getByText('Google Drive')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(button('Connect a WebDAV folder…')).not.toBeNull();
    expect(button('Back')).toBeNull();
  });

  it('opens the list of vaults only once the folder is checked, hiding the settings', async () => {
    const cloud = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Connect a WebDAV folder…' }));

    await act(async () => {
      cloud.webDavForm?.setEndpoint(TEST_FOLDER);
      cloud.webDavForm?.setUsername('me');
      cloud.webDavForm?.setPassword('app-password');
      await cloud.webDavForm?.runCheck();
    });

    expect(screen.queryByLabelText('Login')).toBeNull();
    expect(screen.getByText('Vault').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('offers a new vault right in a reached folder that has none', async () => {
    const onCreate = vi.fn();
    const cloud = renderWizard(onCreate);
    fireEvent.click(screen.getByRole('button', { name: 'Connect a WebDAV folder…' }));
    await act(async () => {
      cloud.webDavForm?.setEndpoint(TEST_FOLDER);
      cloud.webDavForm?.setUsername('me');
      cloud.webDavForm?.setPassword('app-password');
      await cloud.webDavForm?.runCheck();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create a new vault here' }));

    expect(onCreate).toHaveBeenCalledOnce();
  });
});
