import { assert } from '@frozik/utils/assert/assert';
import { membersOf } from '@frozik/vault/model/classify-cards';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { autorun, when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

/** 120 answers in batches of 50. */
const BATCHES_OF_120 = 3;
const URL_SPEC = { kind: 'url', match: 'host', useSharedCredentials: true } as const;

function account(title: string, url: string, login: string, password: string) {
  return aCardWith(
    [
      aField(URL_SPEC, [url]),
      aField({ kind: 'login' }, login),
      aField({ kind: 'password', rotateEveryDays: null }, password, { sensitive: true }),
    ],
    { title }
  );
}

async function vaultWith(device: ReturnType<typeof aDevice>, cards: ReturnType<typeof account>[]) {
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

describe('the audit of an open vault', () => {
  it('fills "Problem passwords" as the estimates and the 2FA list come in', async () => {
    const weak = account('Forum', 'https://forum.example', 'jane', 'short');
    const github = account('GitHub', 'https://github.com', 'jane', 'a-long-password-1');
    const fine = account('Shop', 'https://shop.example', 'jane', 'a-long-password-2');
    const session = await vaultWith(aDevice(), [weak, github, fine]);

    await when(() => session.audit.report.byCard.size === 2);

    expect(session.audit.report.byCard.get(weak.id)).toEqual(['weak']);
    expect(session.audit.report.byCard.get(github.id)).toEqual(['no-2fa']);
    expect(
      membersOf(session.view.classification, 'problems')
        .map(card => card.title)
        .sort()
    ).toEqual(['Forum', 'GitHub']);
  });

  it('groups two cards of one site and login as possible duplicates', async () => {
    const one = account('Bank', 'https://bank.example', 'jane', 'a-long-password-1');
    const two = account(
      'Bank (old)',
      'https://www.bank.example/login',
      'Jane',
      'a-long-password-2'
    );
    const session = await vaultWith(aDevice(), [one, two]);

    expect(
      membersOf(session.view.classification, 'duplicates')
        .map(card => card.id)
        .sort()
    ).toEqual([one.id, two.id].sort());
  });

  it('looks passwords up in breaches only once the user turns it on', async () => {
    const device = aDevice();
    device.breached.add('a-long-but-leaked-password');
    const leaked = account('Mail', 'https://mail.example', 'jane', 'a-long-but-leaked-password');
    const session = await vaultWith(device, [leaked]);
    await when(() => session.audit.twoFactorDomains !== null);

    expect(session.audit.report.byCard.get(leaked.id)).toBeUndefined();
    session.deviceSettings.update({ checkLeaks: true });
    await when(() => session.audit.report.byCard.has(leaked.id));
    expect(session.audit.report.byCard.get(leaked.id)).toEqual(['leaked']);
  });

  it('re-audits the vault a few times while the estimates of many passwords arrive, not once each', async () => {
    const cards = Array.from({ length: 120 }, (_, index) =>
      account(`Site ${index}`, `https://site-${index}.example`, 'jane', `pw${index}`)
    );
    const session = await vaultWith(aDevice(), cards);
    let runs = 0;
    const stop = autorun(() => {
      runs += session.audit.report.byCard.size >= 0 ? 1 : 0;
    });

    await when(() => session.audit.report.byCard.size === cards.length);
    stop();

    expect(runs).toBeLessThanOrEqual(BATCHES_OF_120 + 2);
  });
});
