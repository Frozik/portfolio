import { observer } from 'mobx-react-lite';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';

import { Button } from './kit/Button';
import { useVaultTexts } from './texts';
import { useOpenLink } from './useOpenLink';

/** Every signed APK is published with the release; the installed app never updates itself. */
export const RELEASES_URL =
  'https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest';

/** A newer release: one small button to its page, never a block. */
export const UpdateLink = observer(function UpdateLink({ watch }: { readonly watch: UpdateWatch }) {
  const t = useVaultTexts().update;
  const openLink = useOpenLink();
  if (watch.verdict !== 'available') {
    return null;
  }
  return (
    <Button
      testID="update-link"
      compact
      iconOnly
      icon="system-update"
      label={t.getUpdate}
      onPress={() => openLink(RELEASES_URL)}
    />
  );
});
