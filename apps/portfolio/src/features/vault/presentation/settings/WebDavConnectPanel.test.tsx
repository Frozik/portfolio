import { err, ok } from '@frozik/utils/result/result';
import { act, render, screen } from '@testing-library/react';

import { WebDavConnectForm } from '../../application/WebDavConnectForm';
import type { TProbeWebDav } from '../../domain/ports/webdav-prober';
import { WebDavConnectPanel } from './WebDavConnectPanel';

async function checked(probe: TProbeWebDav) {
  const form = new WebDavConnectForm(probe);
  render(
    <WebDavConnectPanel form={form} action={{ kind: 'keep', onKeep: vi.fn() }} onClose={vi.fn()} />
  );
  await act(async () => {
    form.setEndpoint('https://cloud.example.org/dav/');
    form.setUsername('me');
    form.setPassword('app-password');
    await form.runCheck();
  });
}

describe('WebDavConnectPanel', () => {
  it('shows how to allow this site on each usual server when the page cannot reach it', async () => {
    await checked(() => Promise.resolve(err({ kind: 'cors-blocked' })));

    expect(screen.getByText(/does not allow this site/)).toBeTruthy();
    expect(screen.getByText('Nextcloud')).toBeTruthy();
    expect(screen.getByText(/--allow-origin/).textContent).toContain(window.location.origin);
  });

  it('says plainly when the server cannot refuse a stale write itself', async () => {
    await checked(() =>
      Promise.resolve(
        ok({
          features: {
            conditionalRequests: false,
            moveReplace: true,
            revisionKind: 'etag' as const,
          },
          vaults: [],
        })
      )
    );

    expect(screen.getByText(/cannot refuse a stale write itself/)).toBeTruthy();
    expect(screen.queryByText('Nextcloud')).toBeNull();
  });
});
