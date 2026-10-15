import { assert } from '@frozik/utils/assert/assert';
import { utf8 } from '@frozik/vault/crypto/bytes';
import { CHROME_CSV } from '@frozik/vault/testing/import-fixtures';
import { when } from 'mobx';

import { aDevice } from '../../testing/fake-device';

const PASSWORD = 'correct horse battery staple';

async function aVaultWithCards() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  const importing = session.flows.importInto(key => key);
  await importing.choose(utf8(CHROME_CSV));
  await importing.confirm();
  return { device, session };
}

describe('the backup file', () => {
  it('saves the vault itself, which another device opens as the same vault with its last edits', async () => {
    const { device, session } = await aVaultWithCards();
    const backup = session.flows.backupFileOf();

    await backup.prepare();
    await backup.save();
    const [file] = device.saved;
    assert(file !== undefined);

    const other = aDevice({ seed: 9 });
    other.willPick({ bytes: file.bytes, name: file.name });
    const app = other.startStore();
    const opened = await app.fileOpening?.open();
    assert(opened !== null && opened !== undefined);
    app.choose(opened);
    app.unlock(PASSWORD);
    await when(() => app.session !== null);

    expect({
      step: backup.step.kind,
      name: file.name.endsWith('.pwv'),
      sameVault: opened === session.vaultKey,
      cards: app.session?.document.cards.size,
    }).toEqual({ step: 'saved', name: true, sameVault: true, cards: 2 });
  });
});
