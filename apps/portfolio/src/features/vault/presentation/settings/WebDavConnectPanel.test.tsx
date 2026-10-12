import { err, ok } from '@frozik/utils/result/result';
import { act, render, screen } from '@testing-library/react';

import { WebDavConnectForm } from '../../application/WebDavConnectForm';
import type { TProbeWebDav } from '../../domain/ports/webdav-prober';
import { WebDavConnectPanel, WebDavVaults } from './WebDavConnectPanel';

async function checked(probe: TProbeWebDav) {
  const form = new WebDavConnectForm(probe);
  render(
    <>
      <WebDavConnectPanel form={form} />
      <WebDavVaults form={form} action={{ kind: 'keep', onKeep: vi.fn() }} />
    </>
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

    expect(screen.getByTestId('webdav-cors-blocked')).toBeTruthy();
    expect(screen.getByTestId('cors-snippets').textContent).toContain(window.location.origin);
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

    expect(screen.getByTestId('webdav-writes').getAttribute('data-state')).toBe('check-then-write');
    expect(screen.queryByTestId('cors-snippets')).toBeNull();
  });
});
