import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

/** The reset under the password: the vault named, what goes and what stays, a yes before it happens. */
const ResetVault = observer(({ model }: { readonly model: PopupModel }) => {
  if (!model.confirmingReset) {
    return (
      <button type="button" className={styles.quiet} onClick={model.askToReset}>
        {popupT.reset}
      </button>
    );
  }
  return (
    <div className={styles.confirm} role="alertdialog" aria-label={popupT.reset}>
      <p>{popupT.resetWarning(model.vaultName ?? '')}</p>
      <div className={styles.row}>
        <button type="button" className={styles.danger} onClick={() => void model.reset()}>
          {popupT.resetConfirm}
        </button>
        <button type="button" className={styles.button} onClick={model.cancelReset}>
          {popupT.resetCancel}
        </button>
      </div>
    </div>
  );
});

/** Locked: the master password, the key derived in the worker; the vault can be disconnected from here. */
export const UnlockScreen = observer(({ model }: { readonly model: PopupModel }) => {
  const [password, setPassword] = useState('');
  const unlock = useEventCallback(() => {
    if (password !== '') {
      void model.unlock(password);
      setPassword('');
    }
  });
  const { notice } = model;
  return (
    <>
      <SecretEditor
        aria-label={popupT.masterPassword}
        placeholder={popupT.masterPassword}
        autoComplete="off"
        value={password}
        onValueChange={setPassword}
        locale={navigator.language}
        onEnter={unlock}
      />
      <button type="button" className={styles.primary} disabled={model.busy} onClick={unlock}>
        {model.busy ? popupT.unlocking : popupT.unlock}
      </button>
      {notice?.kind === 'unlock-failed' && (
        <p className={styles.error}>{popupT.failures[notice.failure]}</p>
      )}
      <ResetVault model={model} />
    </>
  );
});
