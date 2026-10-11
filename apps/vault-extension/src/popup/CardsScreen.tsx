import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { observer } from 'mobx-react-lite';

import type { PopupModel } from '../application/PopupModel';
import type { ICardSummary } from '../domain/card-views';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

const CardList = observer(
  ({ model, cards }: { readonly model: PopupModel; readonly cards: readonly ICardSummary[] }) => (
    <ul className={styles.list}>
      {cards.map(card => (
        <li key={card.id}>
          <button type="button" className={styles.item} onClick={() => void model.open(card.id)}>
            <span>{card.title}</span>
            <span className={styles.faint}>
              {[card.login, card.shared ? popupT.shared : null].filter(Boolean).join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
);

/** The page's cards; none ⇒ a search over the whole vault. */
export const CardsScreen = observer(({ model }: { readonly model: PopupModel }) => (
  <>
    {model.pageCards.length > 0 ? (
      <CardList model={model} cards={model.pageCards} />
    ) : (
      <p className={styles.notice}>{popupT.noCards}</p>
    )}
    <TextEditor
      aria-label={popupT.search}
      placeholder={popupT.search}
      value={model.query}
      onValueChange={query => void model.search(query)}
    />
    <CardList model={model} cards={model.results} />
  </>
));
