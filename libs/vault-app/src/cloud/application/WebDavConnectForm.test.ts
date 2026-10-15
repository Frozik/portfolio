import type { TWebDavProbeFailure } from '@frozik/cloud-storage/webdav/webdav-probe';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { IWebDavReach, TProbeWebDav } from '../domain/ports/webdav-prober';
import { WebDavConnectForm } from './WebDavConnectForm';

const REACH: IWebDavReach = {
  features: { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' },
  vaults: [],
};

function filled(probe: TProbeWebDav) {
  const form = new WebDavConnectForm(probe);
  form.setEndpoint('https://cloud.example.org/dav/');
  form.setUsername('me');
  form.setPassword('app-password');
  return form;
}

describe('WebDAV connect form', () => {
  it('checks only a secure address with a login and a password', () => {
    const form = new WebDavConnectForm(() => Promise.resolve(ok(REACH)));
    form.setEndpoint('http://nas.example.org/dav/');
    form.setUsername('me');
    form.setPassword('secret');

    expect(form.addressProblem).toBe('insecure');
    expect(form.canCheck).toBe(false);
  });

  it('shows what the server honours, and forgets it once anything is edited', async () => {
    const form = filled(() => Promise.resolve(ok(REACH)));

    await form.runCheck();
    expect(form.check).toEqual({ kind: 'reachable', reach: REACH });

    form.setUsername('someone-else');
    expect(form.check).toEqual({ kind: 'unchecked' });
  });

  it('says why the page could not reach the server', async () => {
    const form = filled(() => Promise.resolve(err({ kind: 'cors-blocked' })));

    await form.runCheck();

    expect(form.check).toEqual({ kind: 'failed', failure: { kind: 'cors-blocked' } });
  });

  it('drops the answer of a check the user edited past', async () => {
    let answer: (result: TResult<IWebDavReach, TWebDavProbeFailure>) => void = () => undefined;
    const form = filled(
      () =>
        new Promise(resolve => {
          answer = resolve;
        })
    );

    const checking = form.runCheck();
    form.setEndpoint('https://other.example.org/dav/');
    answer(ok(REACH));
    await checking;

    expect(form.check).toEqual({ kind: 'unchecked' });
  });

  it('builds the folder from a chosen service and the login, until the address is typed by hand', () => {
    const form = new WebDavConnectForm(() => Promise.resolve(ok(REACH)));

    form.setPreset('nextcloud');
    form.setServer('cloud.example.org');
    form.setUsername('jane');
    expect(form.endpoint).toBe('https://cloud.example.org/remote.php/dav/files/jane/');

    form.setEndpoint('https://other.example.org/dav/');
    form.setUsername('john');

    expect(form.preset).toBeNull();
    expect(form.endpoint).toBe('https://other.example.org/dav/');
  });
});
