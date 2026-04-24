import { useFunction } from '@frozik/components';
import { ArrowRight } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { MonoKicker } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import type { ColumnId } from '../../domain/types';
import { retroT as t } from '../translations';

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

  const trimmedLength = text.trim().length;
  const isSubmitDisabled = disabled || trimmedLength === 0;

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={t.room.writeCardPrompt}
        rows={TEXTAREA_ROWS}
        disabled={disabled}
        aria-label={`${t.room.addCardPlaceholder} (${columnId})`}
        className={cn(
          'w-full resize-none border-0 border-b border-dashed border-landing-border-soft bg-transparent px-0 py-1 text-[13px] leading-[1.5] text-landing-fg placeholder:text-landing-fg-faint',
          'focus:border-landing-accent focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <MonoKicker tone="faint">
          {text.length} {t.room.charsSuffix}
        </MonoKicker>
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] font-medium tracking-[0.08em] uppercase transition-colors',
            isSubmitDisabled
              ? 'cursor-not-allowed border border-landing-border-soft bg-transparent text-landing-fg-faint'
              : 'cursor-pointer border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
          )}
        >
          {t.room.postSubmit}
          <ArrowRight size={10} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
};

export const AddCardForm = memo(AddCardFormComponent);

export type { AddCardFormProps };
