import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { PinPad } from '@frozik/vault-react/pin-pad/PinPad';
import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import { UnlockScreen } from './UnlockScreen';
import styles from './popup.module.css';

/** Behind a PIN: its pad, one try, and always the way to the master password instead. */
export const QuickUnlockScreen = observer(
  ({ model, digits }: { readonly model: PopupModel; readonly digits: number }) => {
    const [useMaster, setUseMaster] = useState(false);
    if (useMaster) {
      return <UnlockScreen model={model} />;
    }
    return (
      <div className={styles.quick} data-testid="quick-unlock">
        <p className={styles.lead}>{popupT.quick.pinPrompt}</p>
        <PinPad
          length={digits}
          locale={navigator.language}
          disabled={model.busy}
          onComplete={pin => void model.quickUnlock(pin)}
        />
        <p className={styles.faint}>{popupT.quick.oneTry}</p>
        <button
          type="button"
          className={styles.quiet}
          data-testid="use-master-password"
          onClick={() => setUseMaster(true)}
        >
          {popupT.quick.useMaster}
        </button>
        <button
          type="button"
          className={styles.quiet}
          data-testid="lock-completely"
          onClick={() => void model.lockCompletely()}
        >
          {popupT.quick.lockCompletely}
        </button>
      </div>
    );
  }
);
