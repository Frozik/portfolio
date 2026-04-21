import { useFunction } from '@frozik/components';
import { memo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { RoomStore } from '../../application/RoomStore';
import type { ColumnId } from '../../domain/types';
import { retroEnTranslations as t } from '../translations/en';

const TEXTAREA_ROWS = 2;

interface AddCardFormProps {
  columnId: ColumnId;
  store: RoomStore;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const AddCardFormComponent = ({
  columnId,
  store,
  onSubmit,
  disabled = false,
}: AddCardFormProps) => {
  const [text, setText] = useState('');

  const submit = useFunction(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) {
      return;
    }
    onSubmit(trimmed);
    setText('');
    store.setTypingIn(null);
  });

  const handleChange = useFunction((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  });

  const handleKeyDown = useFunction((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  const handleSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  });

  const handleFocus = useFunction(() => {
    store.setTypingIn(columnId);
  });

  const handleBlur = useFunction(() => {
    store.setTypingIn(null);
  });

  const isSubmitDisabled = disabled || text.trim().length === 0;

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={t.room.addCardPlaceholder}
        rows={TEXTAREA_ROWS}
        disabled={disabled}
        aria-label={`${t.room.addCardPlaceholder} (${columnId})`}
        className={
          'w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
          'placeholder:text-text-secondary ' +
          'focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
          'disabled:cursor-not-allowed disabled:opacity-50'
        }
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitDisabled}>
          {t.room.addCardSubmit}
        </Button>
      </div>
    </form>
  );
};

export const AddCardForm = memo(AddCardFormComponent);

export type { AddCardFormProps };
