import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import type { TThemePreference } from '@frozik/vault-app/device/domain/theme';
import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

const PREFERENCES: readonly TThemePreference[] = ['system', 'light', 'dark'];

/** The PIN for the idle lock: the master password once, the PIN twice. */
const QuickUnlockSetUp = observer(({ model }: { readonly model: PopupModel }) => {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const differ = again !== '' && again !== pin;
  const submit = useEventCallback(() => {
    if (password === '' || pin === '' || pin !== again) {
      return;
    }
    void model.setUpQuickUnlock(password, pin);
    setPassword('');
    setPin('');
    setAgain('');
  });
  return (
    <div className={styles.group} data-testid="quick-set-up">
      <p className={styles.faint}>{popupT.quick.intro}</p>
      <SecretEditor
        aria-label={popupT.masterPassword}
        placeholder={popupT.masterPassword}
        autoComplete="off"
        value={password}
        onValueChange={setPassword}
        locale={navigator.language}
      />
      <SecretEditor
        aria-label={popupT.quick.pin}
        placeholder={popupT.quick.pin}
        autoComplete="off"
        value={pin}
        onValueChange={setPin}
        locale={navigator.language}
      />
      <SecretEditor
        aria-label={popupT.quick.pinAgain}
        placeholder={popupT.quick.pinAgain}
        autoComplete="off"
        value={again}
        onValueChange={setAgain}
        onEnter={submit}
        locale={navigator.language}
      />
      {differ && <p className={styles.error}>{popupT.quick.pinsDiffer}</p>}
      <button
        type="button"
        className={styles.button}
        data-testid="quick-set-up-submit"
        disabled={model.busy || password === '' || pin === '' || pin !== again}
        onClick={submit}
      >
        {popupT.quick.setUp}
      </button>
    </div>
  );
});

/** System, light or dark for the popup, remembered in the extension. */
const ThemeChoice = observer(({ appearance }: { readonly appearance: AppearanceModel }) => (
  <fieldset className={styles.segmented} data-testid="appearance" data-state={appearance.scheme}>
    <legend className={styles.label}>{popupT.theme.label}</legend>
    {PREFERENCES.map(preference => (
      <label key={preference}>
        <input
          type="radio"
          name="theme"
          value={preference}
          checked={appearance.preference === preference}
          onChange={() => appearance.choose(preference)}
        />
        {popupT.theme[preference]}
      </label>
    ))}
  </fieldset>
));

/** Under the cards: the PIN for the idle lock and the theme. */
export const PopupSettings = observer(
  ({
    model,
    appearance,
    quickUnlock,
  }: {
    readonly model: PopupModel;
    readonly appearance: AppearanceModel;
    /** A PIN is already set up. */
    readonly quickUnlock: boolean;
  }) => (
    <details className={styles.settings} data-testid="popup-settings">
      <summary>{popupT.settings}</summary>
      <h2 className={styles.label}>{popupT.quick.title}</h2>
      {quickUnlock ? (
        <div className={styles.row} data-testid="quick-on">
          <span className={styles.faint}>{popupT.quick.on}</span>
          <button
            type="button"
            className={styles.quiet}
            onClick={() => void model.switchOffQuickUnlock()}
          >
            {popupT.quick.switchOff}
          </button>
        </div>
      ) : (
        <QuickUnlockSetUp model={model} />
      )}
      {model.notice?.kind === 'quick-refused' && (
        <p className={styles.error}>{popupT.quick.refused}</p>
      )}
      <ThemeChoice appearance={appearance} />
    </details>
  )
);
