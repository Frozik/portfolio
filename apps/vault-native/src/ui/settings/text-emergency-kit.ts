import type { IFileToSave } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import type { TKeysTexts } from '@frozik/vault-app/texts/keys/keys-texts';

const SITE = 'https://ciphra-vault.github.io';
const encoder = new TextEncoder();

/**
 * The Emergency Kit as plain text: a phone has no PDF engine here. The same
 * page as the web's: the vault, the key, the way back in; never the password.
 */
export function textEmergencyKit(
  t: TKeysTexts,
  vaultName: string
): (recoveryKey: string) => Promise<IFileToSave> {
  return recoveryKey => {
    const kit = t.kit;
    const text = [
      kit.title,
      '',
      kit.intro,
      '',
      `${kit.vault}: ${vaultName}`,
      `${kit.recoveryKey}: ${recoveryKey}`,
      `${kit.masterPassword}: ______________________`,
      kit.masterPasswordHint,
      '',
      kit.howTo,
      ...kit.steps(SITE),
      '',
    ].join('\n');
    return Promise.resolve({
      name: `${kit.title} — ${vaultName}.txt`,
      mime: 'text/plain',
      bytes: encoder.encode(text),
    });
  };
}
