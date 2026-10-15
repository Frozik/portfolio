import type { TCombineAspect, TCombineSide } from '@frozik/vault/model/card-combine';
import type { TChangedElsewhere } from '@frozik/vault/model/draft';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import type { CardDraftModel } from '@frozik/vault-app/document/application/CardDraftModel';
import { aspectText, changeKey, changeText } from '@frozik/vault-app/texts/document/change-wording';
import { editorT } from '../texts/editor';

/**
 * Saving over a change made elsewhere: what the other
 * device saved against this edit, and the parts both changed with a choice
 * for each. Every answer is a new version that descends from theirs.
 */
export const ConflictDialog = observer(
  ({
    draft,
    conflict,
    onSaved,
  }: {
    readonly draft: CardDraftModel;
    readonly conflict: TChangedElsewhere;
    readonly onSaved: () => void;
  }) => {
    const t = editorT.conflict;
    const [choices, setChoices] = useState<ReadonlyMap<TCombineAspect, TCombineSide>>(new Map());
    const choose = (aspect: TCombineAspect, side: TCombineSide): void =>
      setChoices(new Map(choices).set(aspect, side));
    const resolve = (saved: boolean): void => {
      if (saved) {
        onSaved();
      }
    };

    return (
      <DialogShell
        open
        onClose={draft.dismissConflict}
        title={t.title}
        description={t.intro}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => resolve(draft.save({ kind: 'take-theirs' }))}
            >
              {t.takeTheirs}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => resolve(draft.save({ kind: 'keep-mine' }))}
            >
              {t.keepMine}
            </Button>
            <Button type="button" onClick={() => resolve(draft.save({ kind: 'combine', choices }))}>
              {t.combine}
            </Button>
          </div>
        }
      >
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-landing-fg-dim">
          {conflict.draftAgainstTheirs.map(change => (
            <li key={changeKey(change)}>{changeText(editorT, change)}</li>
          ))}
        </ul>
        {conflict.clashes.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <span className="text-[13px] font-medium text-landing-fg">{t.clash}</span>
            {conflict.clashes.map(aspect => (
              <div key={aspect} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] text-landing-fg">
                  {aspectText(editorT, aspect, draft.card, conflict.theirs)}
                </span>
                <RadioGroup<TCombineSide>
                  value={choices.get(aspect) ?? 'theirs'}
                  onChange={side => choose(aspect, side)}
                  options={[
                    { value: 'mine', label: t.mine },
                    { value: 'theirs', label: t.theirs },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </DialogShell>
    );
  }
);
