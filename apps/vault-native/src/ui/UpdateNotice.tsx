import { observer } from 'mobx-react-lite';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';

import { Button } from './kit/Button';
import { Notice } from './kit/Notice';
import { useVaultTexts } from './texts';
import { useOpenLink } from './useOpenLink';

/** Every signed APK is published with the release; the installed app never updates itself. */
export const RELEASES_URL =
  'https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest';

/** A newer release: a note and the way to it, never a block. */
export const UpdateNotice = observer(function UpdateNotice({
  watch,
}: {
  readonly watch: UpdateWatch;
}) {
  const t = useVaultTexts().update;
  const openLink = useOpenLink();
  if (watch.verdict !== 'available') {
    return null;
  }
  return (
    <>
      <Notice testID="update-notice" message={t.availablePhone} />
      <Button variant="secondary" label={t.download} onPress={() => openLink(RELEASES_URL)} />
    </>
  );
});
