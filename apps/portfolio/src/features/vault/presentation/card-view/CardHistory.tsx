import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { IVaultCard } from '@frozik/vault/model/card';
import { diffCardStates } from '@frozik/vault/model/card-diff';
import { cardState } from '@frozik/vault/model/revision-edits';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { restore } from '../../application/card-actions';
import type { VaultSession } from '../../application/VaultSession';
import { changeKey, changeText } from '../editor/change-text';
import { vaultT } from '../translations';
import { versionsT } from '../translations/versions';
import { RevisionComparison } from './RevisionComparison';

/**
 * A card's earlier versions, newest first: when each was
 * saved, how it differs from the card now — labels, and side by side on
 * request with secrets kept hidden — and "restore", which is a new edit:
 * the replaced version joins the history.
 */
export const CardHistory = observer(
  ({
    card,
    session,
    backTo,
  }: {
    readonly card: IVaultCard;
    readonly session: VaultSession;
    readonly backTo: string;
  }) => {
    const t = vaultT.history;
    const [restored, setRestored] = useState(false);
    const [comparing, setComparing] = useState<string | null>(null);
    const current = cardState(card);

    return (
      <section className="flex flex-col gap-4">
        <NavLink to={backTo} className="text-[13px] text-landing-fg-dim underline">
          {t.back}
        </NavLink>
        <h2 className="text-[20px] font-medium text-landing-fg">
          {t.title(card.title === '' ? vaultT.list.untitled : card.title)}
        </h2>
        {restored && <Alert type="success" message={t.restored} />}
        {card.history.length === 0 && (
          <p className="text-[14px] text-landing-fg-faint">{t.empty}</p>
        )}
        {card.history.map(revision => {
          const changes = diffCardStates(current, revision.snapshot);
          const key = `${revision.at.wallMs}:${revision.at.counter}:${revision.at.node}`;
          return (
            <CardFrame key={key} className="flex flex-col gap-2 p-4">
              <span className="text-[13px] font-medium text-landing-fg">
                {t.savedAt(formatDateTimeLocal(millisecondsToISO8601(revision.at.wallMs)))}
              </span>
              {changes.length === 0 ? (
                <span className="text-[12px] text-landing-fg-faint">{t.same}</span>
              ) : (
                <>
                  <span className="text-[12px] text-landing-fg-faint">{t.differs}</span>
                  {comparing === key ? (
                    <RevisionComparison changes={changes} />
                  ) : (
                    <ul
                      className="list-disc pl-5 text-[12px] text-landing-fg-dim"
                      data-testid="revision-changes"
                    >
                      {changes.map(change => (
                        <li key={changeKey(change)}>{changeText(change)}</li>
                      ))}
                    </ul>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setComparing(comparing === key ? null : key)}
                  >
                    {comparing === key ? versionsT.compare.hide : versionsT.compare.show}
                  </Button>
                </>
              )}
              {!session.readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    session.transact(restore(card.id, revision.at));
                    setRestored(true);
                  }}
                >
                  {t.restore}
                </Button>
              )}
            </CardFrame>
          );
        })}
      </section>
    );
  }
);
