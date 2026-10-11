import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

/** Locked: the master password, the key derived in the worker. */
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
        onEnter={unlock}
      />
      <button type="button" className={styles.primary} disabled={model.busy} onClick={unlock}>
        {model.busy ? popupT.unlocking : popupT.unlock}
      </button>
      {notice?.kind === 'unlock-failed' && (
        <p className={styles.error}>{popupT.failures[notice.failure]}</p>
      )}
    </>
  );
});
