import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { useKeptWhileChecked } from '@frozik/vault-react/hooks/useKeptWhileChecked';
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
  const [password, setPassword] = useKeptWhileChecked(model.busy);
  const unlock = useEventCallback(() => {
    if (password !== '' && !model.busy) {
      void model.unlock(password);
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
        disabled={model.busy}
      />
      <button
        type="button"
        className={styles.primary}
        data-testid="unlock-submit"
        disabled={model.busy}
        onClick={unlock}
      >
        {model.busy ? popupT.unlocking : popupT.unlock}
      </button>
      {notice?.kind === 'unlock-failed' && (
        <p className={styles.error}>{popupT.failures[notice.failure]}</p>
      )}
      {notice?.kind === 'wrong-pin' && (
        <p className={styles.error} data-testid="unlock-notice">
          {popupT.quick.wrongPin}
        </p>
      )}
      <ResetVault model={model} />
    </>
  );
});
