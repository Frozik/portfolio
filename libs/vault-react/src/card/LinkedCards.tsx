import { Select } from '@frozik/components/components/select/Select';
import type { IVaultCard } from '@frozik/vault/model/card';
import { compareStrings } from '@frozik/vault/model/compare-strings';
import type { TCardId } from '@frozik/vault/model/ids';
import { linkedCardIds } from '@frozik/vault/model/link-edits';
import { isNil } from 'lodash-es';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { link, unlink } from '@frozik/vault-app/document/application/card-actions';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';

const ICON_SIZE = 14;

/** The cards this one belongs with (online banking and its cards): open, unlink, link another. */
export const LinkedCards = observer(
  ({
    card,
    session,
    onOpen,
  }: {
    readonly card: IVaultCard;
    readonly session: VaultSession;
    readonly onOpen: (cardId: TCardId) => void;
  }) => {
    const t = vaultT.cardExtras;
    const [linking, setLinking] = useState(false);
    const [chosen, setChosen] = useState<TCardId | undefined>(undefined);
    const linked = linkedCardIds(session.document, card.id)
      .map(id => session.document.cards.get(id))
      .filter((other): other is IVaultCard => !isNil(other));
    const candidates = [...session.document.cards.values()]
      .filter(other => other.id !== card.id && isNil(other.trashedAt))
      .filter(other => !linked.includes(other))
      .sort((first, second) => compareStrings(first.title, second.title));
    const titleOf = (other: IVaultCard): string => other.title || vaultT.list.untitled;

    if (linked.length === 0 && session.readOnly) {
      return null;
    }
    return (
      <section className="flex flex-col gap-2">
        {linked.length > 0 && <span className="text-[12px] text-landing-fg-faint">{t.linked}</span>}
        {linked.map(other => (
          <div key={other.id} className="flex items-center gap-2">
            <Button type="button" variant="link" onClick={() => onOpen(other.id)}>
              {titleOf(other)}
            </Button>
            {!session.readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t.unlink(titleOf(other))}
                onClick={() => session.transact(unlink(card.id, other.id))}
              >
                <X size={ICON_SIZE} />
              </Button>
            )}
          </div>
        ))}
        {!session.readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setLinking(true)}
          >
            {t.link}
          </Button>
        )}
        {linking && (
          <DialogShell
            open
            onClose={() => setLinking(false)}
            title={t.linkTitle}
            footer={
              <Button
                type="button"
                disabled={isNil(chosen)}
                onClick={() => {
                  if (!isNil(chosen)) {
                    session.transact(link(card.id, chosen));
                  }
                  setLinking(false);
                }}
              >
                {t.linkConfirm}
              </Button>
            }
          >
            <Select<TCardId>
              aria-label={t.linkChoose}
              options={candidates.map(other => ({ value: other.id, label: titleOf(other) }))}
              value={chosen}
              onValueChange={setChosen}
              locale={LANGUAGE}
            />
          </DialogShell>
        )}
      </section>
    );
  }
);
