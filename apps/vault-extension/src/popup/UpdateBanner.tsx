import { observer } from 'mobx-react-lite';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

/** Where every release of the extension is published. */
const RELEASES_URL = 'https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest';

/**
 * A newer release is offered; one below the floor may no longer open the
 * vault (an unpacked extension never updates itself) and says where to get
 * the new one.
 */
export const UpdateBanner = observer(({ watch }: { readonly watch: UpdateWatch }) => {
  if (watch.verdict === 'current') {
    return null;
  }
  return (
    <div className={styles.banner} data-testid="update-notice" data-state={watch.verdict}>
      <p>{watch.verdict === 'required' ? popupT.update.required : popupT.update.available}</p>
      <a href={RELEASES_URL} target="_blank" rel="noreferrer">
        {popupT.update.download}
      </a>
    </div>
  );
});
