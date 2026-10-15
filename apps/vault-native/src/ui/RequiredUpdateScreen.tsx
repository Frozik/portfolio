import { Button } from './kit/Button';
import { Notice } from './kit/Notice';
import { Screen } from './kit/Screen';
import { useVaultTexts } from './texts';
import { RELEASES_URL } from './UpdateNotice';
import { useOpenLink } from './useOpenLink';

const PRODUCT_NAME = 'Ciphra Vault';

/** A build below the security floor: the vault is locked and stays so until the new APK is installed. */
export function RequiredUpdateScreen() {
  const t = useVaultTexts().update;
  const openLink = useOpenLink();
  return (
    <Screen title={PRODUCT_NAME} testID="update-required">
      <Notice tone="error" message={t.requiredPhone} />
      <Button label={t.download} onPress={() => openLink(RELEASES_URL)} />
    </Screen>
  );
}
