import type { THkdfLabel } from '../crypto/hkdf';
import { deriveAesKey } from '../crypto/hkdf';
import type { ISealedRecordStore, TVaultKey } from '../persistence/ports';
import { openRecord, sealRecord } from '../persistence/record-cipher';
import type { IRandom } from '../ports/random';

/**
 * After a key rotation this device's records (settings, cloud
 * credentials, drafts) are sealed again under the new key. One already under
 * the new key stays, so a second run changes nothing; one neither key opens is
 * of no use to anyone and goes.
 */
export async function resealRecords({
  store,
  vaultKey,
  label,
  from,
  to,
  random,
}: {
  readonly store: ISealedRecordStore;
  readonly vaultKey: TVaultKey;
  readonly label: THkdfLabel;
  readonly from: CryptoKey;
  readonly to: CryptoKey;
  readonly random: IRandom;
}): Promise<void> {
  const [oldKey, newKey] = await Promise.all([deriveAesKey(from, label), deriveAesKey(to, label)]);
  const recordKeys = await store.keys(vaultKey);
  for (const recordKey of recordKeys.ok ? recordKeys.value : []) {
    const slot = { vaultKey, recordKey };
    const sealed = await store.get(vaultKey, recordKey);
    if (!sealed.ok || sealed.value === null) {
      continue;
    }
    const opened = await openRecord(oldKey, slot, sealed.value);
    if (opened.ok) {
      await store.put(vaultKey, recordKey, await sealRecord(newKey, slot, opened.value, random));
    } else if (!(await openRecord(newKey, slot, sealed.value)).ok) {
      await store.delete(vaultKey, recordKey);
    }
  }
}
