import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

/** A week since the master password: the popup asks for it, and never locks for it. */
export const ReminderPrompt = observer(({ model }: { readonly model: PopupModel }) => {
  const [password, setPassword] = useState('');
  const submit = useEventCallback(() => {
    if (password !== '') {
      void model.remind(password);
      setPassword('');
    }
  });
  return (
    <div className={styles.banner} data-testid="reminder">
      <p>{popupT.reminder.body}</p>
      <SecretEditor
        aria-label={popupT.masterPassword}
        placeholder={popupT.masterPassword}
        autoComplete="off"
        value={password}
        onValueChange={setPassword}
        onEnter={submit}
        locale={navigator.language}
      />
      <button type="button" className={styles.button} onClick={submit}>
        {popupT.reminder.submit}
      </button>
      {model.notice?.kind === 'reminder-refused' && (
        <p className={styles.error}>{popupT.reminder.refused}</p>
      )}
    </div>
  );
});
