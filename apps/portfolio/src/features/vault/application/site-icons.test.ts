import { assert } from '@frozik/utils/assert/assert';
import type { IVaultCard } from '@frozik/vault/model/card';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from './fake-device.test-helper';

const URL_SPEC = { kind: 'url', match: 'host', useSharedCredentials: true } as const;

function site(url: string): IVaultCard {
  return aCardWith([aField(URL_SPEC, [url])], { title: url });
}

async function vaultWith(device: ReturnType<typeof aDevice>, cards: readonly IVaultCard[]) {
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  session.apply((document, at) => ({
    ...document,
    cards: new Map([
      ...document.cards,
      ...cards.map(card => [card.id, { ...card, createdAt: at, updatedAt: at }] as const),
    ]),
  }));
  return session;
}

describe('site icons of an open vault', () => {
  it('fetches each site’s icon once and shows it on every card of that site', async () => {
    const device = aDevice({ siteIcons: { 'github.com': 'icon' } });
    const login = site('https://github.com/login');
    const gist = site('https://gist.github.com');
    const session = await vaultWith(device, [login, gist]);

    await when(() => session.document.siteIcons.has('github.com'));

    expect(device.siteIconRequests).toEqual(['github.com']);
    expect(session.view.siteIconOf(login)).not.toBeNull();
    expect(session.view.siteIconOf(gist)).not.toBeNull();
  });

  it('remembers a site without an icon and asks nothing more this session', async () => {
    const device = aDevice({ siteIcons: { 'noicon.example': 'none' } });
    const card = site('https://noicon.example');
    const session = await vaultWith(device, [card]);

    await when(() => session.document.siteIcons.get('noicon.example')?.kind === 'none');
    session.apply(document => ({ ...document }));

    expect(device.siteIconRequests).toEqual(['noicon.example']);
    expect(session.view.siteIconOf(card)).toBeNull();
  });

  it('asks no service while the device setting is off', async () => {
    const device = aDevice({ siteIcons: { 'github.com': 'icon' } });
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const { session } = store;
    assert(session !== null);
    session.deviceSettings.update({ loadSiteIcons: false });
    session.apply((document, at) => {
      const card = site('https://github.com');
      return {
        ...document,
        cards: new Map([...document.cards, [card.id, { ...card, createdAt: at, updatedAt: at }]]),
      };
    });

    expect(device.siteIconRequests).toEqual([]);
  });

  it('opens the demo with its icons in place, asking no service', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.startDemo('Demo', key => key);
    await when(() => (store.session?.document.cards.size ?? 0) > 0);

    expect(device.siteIconRequests).toEqual([]);
  });
});
