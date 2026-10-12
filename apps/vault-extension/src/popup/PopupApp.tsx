import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { PopupModel } from '../application/PopupModel';
import { CardScreen } from './CardScreen';
import { CardsScreen } from './CardsScreen';
import { popupT } from './popup-texts';
import { SetupScreen } from './SetupScreen';
import { UnlockScreen } from './UnlockScreen';
import styles from './popup.module.css';

const Body = observer(({ model }: { readonly model: PopupModel }) => {
  const { status, opened } = model;
  if (isNil(status)) {
    return null;
  }
  switch (status.kind) {
    case 'not-set-up':
      return <SetupScreen model={model} />;
    case 'locked':
      return <UnlockScreen model={model} />;
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
        <CardsScreen model={model} />
      ) : (
        <CardScreen model={model} card={opened} />
      );
    default:
      return assertNever(status);
  }
});

const Sheet = observer(({ model }: { readonly model: PopupModel }) => (
  <main className={model.inTab ? styles.sheet : styles.popup}>
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
    <Body model={model} />
  </main>
));

/** The popup: the page's host on top, then setup, unlock or the cards; opened as a tab, one card centred on the page. */
export const PopupApp = observer(({ model }: { readonly model: PopupModel }) =>
  model.inTab ? (
    <div className={styles.page}>
      <Sheet model={model} />
    </div>
  ) : (
    <Sheet model={model} />
  )
);
