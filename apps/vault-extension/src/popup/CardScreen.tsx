import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TotpCode } from '@frozik/vault/react/totp/TotpCode';
import { isNil } from 'lodash-es';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import type { ICardView, IFieldView } from '../domain/card-views';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

const ICON_SIZE = 14;

const now = (): Temporal.Instant => Temporal.Now.instant();

const FieldRow = observer(
  ({ model, field }: { readonly model: PopupModel; readonly field: IFieldView }) => {
    const shown = model.revealed.get(field.id) ?? field.value;
    if (field.kind === 'otp') {
      return (
        <div className={styles.field}>
          <span className={styles.faint}>{field.label}</span>
          {isNil(shown) ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={popupT.show}
              title={popupT.show}
              onClick={() => void model.reveal(field.id)}
            >
              <Eye size={ICON_SIZE} aria-hidden="true" />
            </button>
          ) : (
            <TotpCode
              uri={shown}
              now={now}
              locale={navigator.language}
              onCopy={() => void model.copy(field.id, true)}
            />
          )}
        </div>
      );
    }
    return (
      <div className={styles.field}>
        <span className={styles.faint}>{field.label}</span>
        <div className={styles.row}>
          <span className={styles.value}>{shown ?? '••••••••'}</span>
          {field.sensitive &&
            (isNil(model.revealed.get(field.id)) ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-label={popupT.show}
                title={popupT.show}
                onClick={() => void model.reveal(field.id)}
              >
                <Eye size={ICON_SIZE} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className={styles.iconButton}
                aria-label={popupT.hide}
                title={popupT.hide}
                onClick={() => model.hide(field.id)}
              >
                <EyeOff size={ICON_SIZE} aria-hidden="true" />
              </button>
            ))}
          <button
            type="button"
            className={styles.iconButton}
            aria-label={popupT.copy}
            title={popupT.copy}
            onClick={() => void model.copy(field.id)}
          >
            <Copy size={ICON_SIZE} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }
);

/** A protected card asks for the master password before its secrets leave the worker. */
const ProtectedGate = observer(({ model }: { readonly model: PopupModel }) => {
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const open = useEventCallback(async () => {
    const failure = await model.openProtected(password);
    setPassword('');
    setFailed(!isNil(failure));
  });
  return (
    <div className={styles.field}>
      <span className={styles.notice}>{popupT.protected}</span>
      <div className={styles.row}>
        <SecretEditor
          aria-label={popupT.masterPassword}
          autoComplete="off"
          value={password}
          onValueChange={setPassword}
          locale={navigator.language}
          onEnter={() => void open()}
        />
        <button type="button" className={styles.button} onClick={() => void open()}>
          {popupT.open}
        </button>
      </div>
      {failed && <span className={styles.error}>{popupT.failures['wrong-password']}</span>}
    </div>
  );
});

/** One card: its fields with copy and show, the code, and "Fill". */
export const CardScreen = observer(
  ({ model, card }: { readonly model: PopupModel; readonly card: ICardView }) => {
    const { notice } = model;
    return (
      <>
        <div className={styles.header}>
          <button type="button" className={styles.button} onClick={model.back}>
            {popupT.back}
          </button>
          <strong>{card.title}</strong>
        </div>
        {card.protected && <ProtectedGate model={model} />}
        {card.fields.map(field => (
          <FieldRow key={field.id} model={model} field={field} />
        ))}
        {model.confirmingInsecure ? (
          <div className={styles.row}>
            <span className={styles.error}>{popupT.insecure}</span>
            <button type="button" className={styles.primary} onClick={() => void model.fill(true)}>
              {popupT.fillAnyway}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.primary} onClick={() => void model.fill()}>
            {popupT.fill}
          </button>
        )}
        {notice?.kind === 'fill' && (
          <p className={styles.notice}>{popupT.outcomes[notice.outcome]}</p>
        )}
        {notice?.kind === 'copied' && <p className={styles.notice}>{popupT.copied}</p>}
      </>
    );
  }
);
