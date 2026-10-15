import { utf8 } from '@frozik/vault/crypto/bytes';
import { generateDek, importDek } from '@frozik/vault/crypto/dek';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';

import { quickKeyOf } from '../domain/quick-key';
import { createMemoryKeyCustody } from './memory-key-custody';

async function aKey() {
  const random = createSeededRandom(4);
  return { random, key: { dek: await importDek(generateDek(random)), keyId: Uint8Array.of(1) } };
}

describe('the memory key custody', () => {
  it('gives the key back to the right quick code, once', async () => {
    const { random, key } = await aKey();
    const custody = createMemoryKeyCustody(random);
    const right = await quickKeyOf(utf8('pepper+pin:1234'));

    await custody.lockQuick('v1', key, right);

    expect(await custody.unlockQuick('v1', right)).toBe(key);
    expect(await custody.unlockQuick('v1', right)).toBeNull();
  });

  it('keeps nothing after one wrong code, so the right one no longer helps', async () => {
    const { random, key } = await aKey();
    const custody = createMemoryKeyCustody(random);
    const right = await quickKeyOf(utf8('pepper+pin:1234'));

    await custody.lockQuick('v1', key, right);

    expect(await custody.unlockQuick('v1', await quickKeyOf(utf8('pepper+pin:0000')))).toBeNull();
    expect(await custody.unlockQuick('v1', right)).toBeNull();
  });

  it('gives nothing for another vault, and nothing after a release', async () => {
    const { random, key } = await aKey();
    const custody = createMemoryKeyCustody(random);
    const right = await quickKeyOf(utf8('pepper+pin:1234'));

    await custody.lockQuick('v1', key, right);
    expect(await custody.unlockQuick('v2', right)).toBeNull();

    await custody.lockQuick('v1', key, right);
    await custody.release();
    expect(await custody.unlockQuick('v1', right)).toBeNull();
  });

  it('never restores a key: a process that comes back is locked', async () => {
    const { random, key } = await aKey();
    const custody = createMemoryKeyCustody(random);

    await custody.hold('v1', key);

    expect(await custody.restore('v1')).toBeNull();
  });
});
