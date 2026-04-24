import { useFunction } from '@frozik/components';
import { Plus, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { CardFrame, MonoKicker } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { SOFT_ACTION_ITEM_LIMIT } from '../../domain/constants';
import type { ActionItemId } from '../../domain/types';
import { ERetroPhase } from '../../domain/types';
import { retroT as t } from '../translations';

interface ActionItemsListProps {
  readonly store: RoomStore;
}

export const ActionItemsList = observer(({ store }: ActionItemsListProps) => {
  const phase = store.phase;
  const items = store.currentSnapshot?.actionItems ?? [];

  const canEdit = phase === ERetroPhase.Discuss || phase === ERetroPhase.Close;
  const showSoftLimitTip = items.length >= SOFT_ACTION_ITEM_LIMIT;

  if (!canEdit && items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <MonoKicker tone="accent" className="text-[11px]">
          {t.discuss.actionItemsKicker} · {items.length}
        </MonoKicker>
        {showSoftLimitTip && <MonoKicker tone="faint">{t.discuss.actionItemsTipKicker}</MonoKicker>}
        <span className="section-rule" />
      </div>

      <CardFrame className="flex flex-col">
        {items.length > 0 && (
          <ul className="flex flex-col">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={cn(index > 0 && 'border-t border-dashed border-landing-border-soft')}
              >
                <ActionItemRow id={item.id} text={item.text} canEdit={canEdit} store={store} />
              </li>
            ))}
          </ul>
        )}

        {canEdit && <ActionItemComposer hasItems={items.length > 0} store={store} />}
      </CardFrame>
    </div>
  );
});

interface ActionItemRowProps {
  readonly id: ActionItemId;
  readonly text: string;
  readonly canEdit: boolean;
  readonly store: RoomStore;
}

const ActionItemRow = observer(({ id, text, canEdit, store }: ActionItemRowProps) => {
  const handleDelete = useFunction(() => {
    store.deleteActionItem(id);
  });

  return (
    <div className="group flex items-start gap-3 px-4 py-3">
      <span aria-hidden="true" className="pt-1.5 text-landing-fg-faint">
        ·
      </span>
      <p className="m-0 flex-1 text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-landing-fg">
        {text}
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label={t.discuss.deleteActionItem}
          title={t.discuss.deleteActionItem}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-landing-border-soft text-landing-fg-faint opacity-0 transition-all hover:border-landing-red/40 hover:text-landing-red focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
});

interface ActionItemComposerProps {
  readonly hasItems: boolean;
  readonly store: RoomStore;
}

const ActionItemComposer = observer(({ hasItems, store }: ActionItemComposerProps) => {
  const [draft, setDraft] = useState('');
  const trimmedLength = draft.trim().length;
  const isSubmitDisabled = trimmedLength === 0;

  const handleChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  });

  const handleSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }
    store.addActionItem(draft);
    setDraft('');
  });

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        hasItems && 'border-t border-dashed border-landing-border-soft'
      )}
    >
      <input
        type="text"
        value={draft}
        onChange={handleChange}
        placeholder={t.discuss.actionItemPlaceholder}
        aria-label={t.discuss.actionItemsTitle}
        className={cn(
          'flex-1 border-0 border-b border-dashed border-landing-border-soft bg-transparent px-0 py-1 text-[13px] leading-[1.5] text-landing-fg placeholder:text-landing-fg-faint',
          'focus:border-landing-accent focus:outline-none'
        )}
      />
      <button
        type="submit"
        disabled={isSubmitDisabled}
        aria-label={t.discuss.addActionItem}
        title={t.discuss.addActionItem}
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center border transition-colors',
          isSubmitDisabled
            ? 'cursor-not-allowed border-landing-border-soft text-landing-fg-faint'
            : 'cursor-pointer border-landing-accent/40 bg-landing-accent/10 text-landing-accent hover:bg-landing-accent/20'
        )}
      >
        <Plus size={12} strokeWidth={2} />
      </button>
    </form>
  );
});
