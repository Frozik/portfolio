import { useFunction } from '@frozik/components';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Alert, Button } from '../../../../shared/ui';
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
  const [draft, setDraft] = useState('');

  const handleChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  });

  const handleSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.trim().length === 0) {
      return;
    }
    store.addActionItem(draft);
    setDraft('');
  });

  const handleDelete = useFunction((id: ActionItemId) => store.deleteActionItem(id));

  const canEdit = phase === ERetroPhase.Discuss || phase === ERetroPhase.Close;
  if (phase !== ERetroPhase.Discuss && phase !== ERetroPhase.Close && items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        {t.discuss.actionItemsTitle}
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map(item => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface-elevated p-2 text-sm"
          >
            <span className="flex-1 whitespace-pre-wrap break-words">{item.text}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                aria-label={t.discuss.deleteActionItem}
                className="text-text-muted transition-colors hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {items.length >= SOFT_ACTION_ITEM_LIMIT && (
        <Alert type="warning" message={t.discuss.tooManyActionsWarning} />
      )}

      {canEdit && (
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={handleChange}
            placeholder={t.discuss.actionItemPlaceholder}
            className="h-9 flex-1 rounded-md border border-border bg-surface-elevated px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <Button type="submit" variant="secondary" size="sm">
            {t.discuss.addActionItem}
          </Button>
        </form>
      )}
    </section>
  );
});
