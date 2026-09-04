import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { ArrowRight } from 'lucide-react';
import { memo, useState } from 'react';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { ColumnId } from '../../domain/types';
import { retroT } from '../translations';

const TEXTAREA_ROWS = 2;

const AddCardFormComponent = ({
  columnId,
  onTypingChange,
  onSubmit,
  disabled = false,
}: {
  readonly columnId: ColumnId;
  /** Reports which column the author is typing in, or none once the field is left. */
  readonly onTypingChange: (columnId: ColumnId | undefined) => void;
  readonly onSubmit: (text: string) => void;
  readonly disabled?: boolean;
}) => {
  const [text, setText] = useState('');

  const submit = useFunction(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) {
      return;
    }
    onSubmit(trimmed);
    setText('');
    onTypingChange(undefined);
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
    onTypingChange(columnId);
  });

  const handleBlur = useFunction(() => {
    onTypingChange(undefined);
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
        placeholder={retroT.room.writeCardPrompt}
        rows={TEXTAREA_ROWS}
        disabled={disabled}
        aria-label={`${retroT.room.addCardPlaceholder} (${columnId})`}
        className={cn(
          'w-full resize-none border-0 border-b border-dashed border-landing-border-soft bg-transparent px-0 py-1 text-[13px] leading-[1.5] text-landing-fg placeholder:text-landing-fg-faint',
          'focus:border-landing-accent focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <MonoKicker tone="faint">
          {text.length} {retroT.room.charsSuffix}
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
          {retroT.room.postSubmit}
          <ArrowRight size={10} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
};

export const AddCardForm = memo(AddCardFormComponent);
