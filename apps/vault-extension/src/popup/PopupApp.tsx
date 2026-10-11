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
      return isNil(opened) ? (
        <CardsScreen model={model} />
      ) : (
        <CardScreen model={model} card={opened} />
      );
    default:
      return assertNever(status);
  }
});

/** The popup: the page's host on top, then setup, unlock or the cards. */
export const PopupApp = observer(({ model }: { readonly model: PopupModel }) => (
  <main className={styles.popup}>
    <header className={styles.header}>
      <strong>{model.vaultName ?? popupT.title}</strong>
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
