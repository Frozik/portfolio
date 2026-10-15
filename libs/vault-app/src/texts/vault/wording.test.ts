import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';

import { cloudTranslationsEn as cloud } from '../cloud/cloud-en';
import { dataTranslationsEn as data } from '../interchange/data-en';
import { keysTranslationsEn as keys } from '../keys/keys-en';
import { vaultTranslationsEn as vault } from './vault-en';

import { MASTER_PASSWORD_MIN_LENGTH } from '../../keys/domain/master-password';
import { adoptFailureText, cloudStatusText, webDavFailureText } from '../cloud/cloud-wording';
import {
  exportProblemText,
  importWarningText,
  sourcePasswordTexts,
} from '../interchange/data-wording';
import {
  changePasswordProblemText,
  passkeyFailureText,
  recoveryUnlockFailureText,
} from '../keys/keys-wording';
import { saveStatusText, snapshotSizeText } from './status-wording';
import { storageFailureText } from './storage-failure-wording';

describe('the words for a state', () => {
  it('tell a full device from storage that is not there', () => {
    const fail = (
      code: EValueDescriptorErrorCode.RESOURCE_EXHAUSTED | EValueDescriptorErrorCode.UNAVAILABLE
    ) => Fail(code, { message: 'storage' });

    expect(storageFailureText(vault, fail(EValueDescriptorErrorCode.RESOURCE_EXHAUSTED))).toBe(
      vault.failures.quota
    );
    expect(storageFailureText(vault, fail(EValueDescriptorErrorCode.UNAVAILABLE))).toBe(
      vault.failures.unavailable
    );
  });

  it('name the HTTP status a server answered with', () => {
    expect(webDavFailureText(cloud, { kind: 'server', status: 503 })).toContain('503');
    expect(
      adoptFailureText(cloud, { kind: 'storage', error: { kind: 'server', status: 507 } })
    ).toContain('507');
  });

  it('tell a full cloud from one being retried', () => {
    const texts = { cloud, vault };
    const quota = cloudStatusText(texts, { kind: 'waiting', cause: { kind: 'quota' } });
    const retrying = cloudStatusText(texts, { kind: 'waiting', cause: { kind: 'conflicts' } });

    expect(quota).not.toBe(retrying);
  });

  it('name the shortest master password allowed', () => {
    const minimum = String(MASTER_PASSWORD_MIN_LENGTH);

    expect(changePasswordProblemText(keys, 'too-short')).toContain(minimum);
    expect(exportProblemText(data, 'too-short')).toContain(minimum);
  });

  it('give a passkey’s own failure and an unlock failure their own words', () => {
    const texts = { keys, vault };

    expect(passkeyFailureText(texts, 'cancelled')).toBe(keys.passkeys.failures.cancelled);
    expect(passkeyFailureText(texts, 'wrong-password')).toBe(
      vault.unlock.failures['wrong-password']
    );
    expect(recoveryUnlockFailureText(texts, 'wrong-password')).toBe(keys.unlock.wrongKey);
  });

  it('point at the row an import skipped', () => {
    expect(importWarningText(data, { kind: 'row-skipped', row: 42 })).toContain('42');
  });

  it('ask for the password a locked source needs', () => {
    expect(sourcePasswordTexts(data, 'kdbx').label).toBe(data.import.keePassPassword);
    expect(sourcePasswordTexts(data, 'pwv').label).toBe(data.import.vaultPassword);
  });

  it('say a save is in progress during any step of writing', () => {
    const writing = saveStatusText(vault, {
      context: {
        guard: {
          vaultId: 'v',
          keyId: 'k',
          maxSeenRevision: 0,
          maxSeenKeyslotsEpoch: 0,
          hashAtMaxSeen: null,
          retiredKeyIds: [],
        },
        lastSyncedRev: null,
        pending: false,
        attempt: 0,
        rolledBack: false,
      },
      phase: { kind: 'statting', intent: 'push' },
    });

    expect(writing).toBe(vault.status.saving);
  });

  it('size a backup in whole kilobytes, never zero', () => {
    expect(snapshotSizeText(10, 'en')).toBe('1 kB');
    expect(snapshotSizeText(10 * 1024, 'en')).toBe('10 kB');
  });
});
