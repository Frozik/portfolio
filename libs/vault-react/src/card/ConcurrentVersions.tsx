import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCombineAspect, TCombineSide } from '@frozik/vault/model/card-combine';
import { combineClashes } from '@frozik/vault/model/card-combine';
import { diffCardStates } from '@frozik/vault/model/card-diff';
import type { TConcurrentResolution } from '@frozik/vault/model/card-versions';
import { concurrentVersions, threeWayBase } from '@frozik/vault/model/card-versions';
import { cardState } from '@frozik/vault/model/revision-edits';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { editorT } from '../texts/editor';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import { resolveConcurrent } from '@frozik/vault-app/document/application/card-actions';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { aspectText, changeKey, changeText } from '@frozik/vault-app/texts/document/change-wording';
import { versionsT } from '../texts/versions';

/**
 * The merge kept a version of this card made at the same time
 * on another device; nobody has decided about it yet. The dialog shows what
 * differs and asks, where both changed the same thing, which to keep. Each
 * answer is a new version that takes the other one in, on every device.
 */
export const ConcurrentVersions = observer(
  ({ card, session }: { readonly card: IVaultCard; readonly session: VaultSession }) => {
    const t = versionsT.concurrent;
    const [reviewing, setReviewing] = useState(false);
    const [choices, setChoices] = useState<ReadonlyMap<TCombineAspect, TCombineSide>>(new Map());
    const [other] = concurrentVersions(card);
    if (other === undefined || session.readOnly) {
      return null;
    }
    const current = cardState(card);
    const changes = diffCardStates(current, other.snapshot);
    const clashes = combineClashes(threeWayBase(card, other.snapshot), current, other.snapshot);
    const resolve = (resolution: TConcurrentResolution): void => {
      session.transact(resolveConcurrent(card.id, resolution));
      setReviewing(false);
    };

    return (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <Alert type="warning" message={t.message} description={t.description} />
          <Button type="button" size="sm" onClick={() => setReviewing(true)}>
            {t.review}
          </Button>
        </div>
        <DialogShell
          open={reviewing}
          onClose={() => setReviewing(false)}
          title={t.title}
          description={t.intro}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setReviewing(false)}>
                {t.cancel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => resolve({ kind: 'take', version: other.at })}
              >
                {t.take}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => resolve({ kind: 'keep-current', version: other.at })}
              >
                {t.keep}
              </Button>
              <Button
                type="button"
                onClick={() => resolve({ kind: 'combine', version: other.at, choices })}
              >
                {t.combine}
              </Button>
            </div>
          }
        >
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-landing-fg-dim">
            {changes.map(change => (
              <li key={changeKey(change)}>{changeText(editorT, change)}</li>
            ))}
          </ul>
          {clashes.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              <span className="text-[13px] font-medium text-landing-fg">{t.clash}</span>
              {clashes.map(aspect => (
                <div key={aspect} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] text-landing-fg">
                    {aspectText(editorT, aspect, other.snapshot, current)}
                  </span>
                  <RadioGroup<TCombineSide>
                    value={choices.get(aspect) ?? 'theirs'}
                    onChange={side => setChoices(new Map(choices).set(aspect, side))}
                    options={[
                      { value: 'theirs', label: t.thisVersion },
                      { value: 'mine', label: t.otherVersion },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogShell>
      </>
    );
  }
);
