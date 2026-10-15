import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

import type { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { PopupModel } from '../application/PopupModel';
import { CardScreen } from './CardScreen';
import { CardsScreen } from './CardsScreen';
import { popupT } from './popup-texts';
import { PopupSettings } from './PopupSettings';
import { QuickUnlockScreen } from './QuickUnlockScreen';
import { ReminderPrompt } from './ReminderPrompt';
import { SetupScreen } from './SetupScreen';
import { UnlockScreen } from './UnlockScreen';
import { UpdateBanner } from './UpdateBanner';
import styles from './popup.module.css';

interface IPopupParts {
  readonly model: PopupModel;
  readonly appearance: AppearanceModel;
  readonly updates: UpdateWatch;
}

const Body = observer(({ model, appearance, updates }: IPopupParts) => {
  const { status, opened } = model;
  if (isNil(status)) {
    return null;
  }
  if (updates.verdict === 'required' && status.kind !== 'not-set-up') {
    return null;
  }
  switch (status.kind) {
    case 'not-set-up':
      return <SetupScreen model={model} />;
    case 'locked':
      return <UnlockScreen model={model} />;
    case 'quick-locked':
      return <QuickUnlockScreen model={model} digits={status.digits} />;
    case 'unlocked':
      if (model.inTab) {
        return (
          <>
            <p className={styles.lead}>{popupT.connected}</p>
            <button type="button" className={styles.primary} onClick={model.closeTab}>
              {popupT.closeTab}
            </button>
          </>
        );
      }
      return isNil(opened) ? (
        <>
          {status.reminderDue && <ReminderPrompt model={model} />}
          <CardsScreen model={model} />
          <PopupSettings model={model} appearance={appearance} quickUnlock={status.quickUnlock} />
        </>
      ) : (
        <CardScreen model={model} card={opened} />
      );
    default:
      return assertNever(status);
  }
});

const Sheet = observer(({ model, appearance, updates }: IPopupParts) => (
  <main
    className={cn(controlTokens.tokens, model.inTab ? styles.sheet : styles.popup)}
    data-theme={appearance.preference}
  >
    <header className={styles.header}>
      {model.inTab ? (
        <h1 className={styles.title}>{model.vaultName ?? popupT.driveTabTitle}</h1>
      ) : (
        <strong>{model.vaultName ?? popupT.title}</strong>
      )}
      {model.status?.kind === 'unlocked' && (
        <button type="button" className={styles.button} onClick={() => void model.lock()}>
          {popupT.lock}
        </button>
      )}
    </header>
    {!isNil(model.host) && (
      <span className={styles.host}>
        {model.host.unicode}
        {!isNil(model.host.punycode) && ` (${model.host.punycode})`}
      </span>
    )}
    <UpdateBanner watch={updates} />
    <Body model={model} appearance={appearance} updates={updates} />
  </main>
));

/** The popup: the page's host on top, then setup, unlock or the cards; opened as a tab, one card centred on the page. */
export const PopupApp = observer((parts: IPopupParts) =>
  parts.model.inTab ? (
    <div className={cn(controlTokens.tokens, styles.page)} data-theme={parts.appearance.preference}>
      <Sheet {...parts} />
    </div>
  ) : (
    <Sheet {...parts} />
  )
);
