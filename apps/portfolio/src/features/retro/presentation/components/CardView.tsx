import { useFunction } from '@frozik/components';
import { Check, Pencil, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { REDACTED_CARD_PLACEHOLDER } from '../../domain/constants';
import type { ERetroPhase, IRetroCard } from '../../domain/types';
import { useCardFlipState } from '../hooks/useCardFlipState';
import styles from '../styles.module.scss';
import { retroT as t } from '../translations';

interface CardViewProps {
  card: IRetroCard;
  isOwn: boolean;
  phase: ERetroPhase;
  showVotes: boolean;
  voteCount: number;
  voteSlot?: ReactNode;
  staggerIndex?: number;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
}

const STAGGER_STEP_MS = 60;

const CardViewComponent = ({
  card,
  isOwn,
  phase,
  showVotes,
  voteCount,
  voteSlot,
  staggerIndex = 0,
  onEdit,
  onDelete,
}: CardViewProps) => {
  const flipState = useCardFlipState(phase, isOwn);
  const isHidden = flipState === 'hidden';

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);

  const handleDeleteClick = useFunction(() => {
    onDelete?.();
  });

  const handleStartEdit = useFunction(() => {
    setDraft(card.text);
    setIsEditing(true);
  });

  const handleCancelEdit = useFunction(() => {
    setIsEditing(false);
    setDraft(card.text);
  });

  const handleSaveEdit = useFunction(() => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (trimmed !== card.text) {
      onEdit?.(trimmed);
    }
    setIsEditing(false);
  });

  const handleDraftChange = useFunction((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
  });

  const handleDraftKeyDown = useFunction((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  });

  const flipDelayStyle =
    flipState === 'revealing'
      ? { transitionDelay: `${staggerIndex * STAGGER_STEP_MS}ms` }
      : undefined;

  return (
    <div className={cn(styles.cardFlipContainer, 'relative min-h-[80px] w-full')}>
      <div
        className={cn(
          styles.cardFlipInner,
          'relative min-h-[80px] w-full',
          isHidden && styles.cardFlipInnerHidden
        )}
        style={flipDelayStyle}
      >
        <div
          className={cn(
            styles.cardBack,
            'flex min-h-[80px] w-full items-center justify-center rounded-md border border-border bg-surface-overlay text-text-secondary'
          )}
          aria-hidden="true"
        >
          <span className="text-sm">
            {REDACTED_CARD_PLACEHOLDER} {t.room.cardBackLabel}
          </span>
        </div>

        <div
          className={cn(
            styles.cardFace,
            'flex min-h-[80px] w-full flex-col gap-2 rounded-md border border-border bg-surface-elevated p-3 text-sm text-text shadow-sm'
          )}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleDraftKeyDown}
                rows={2}
                className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  aria-label={t.room.cancelEdit}
                  className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-surface-overlay hover:text-text"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  aria-label={t.room.saveCard}
                  className="flex h-6 w-6 items-center justify-center rounded text-emerald-500 hover:bg-emerald-500/10"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 whitespace-pre-wrap break-words">{card.text}</p>
              {isOwn && (
                <div className="flex shrink-0 items-center gap-1">
                  {onEdit !== undefined && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      aria-label={t.room.editCard}
                      className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {onDelete !== undefined && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      aria-label={t.room.deleteCard}
                      className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!isEditing && (voteSlot !== undefined || (showVotes && voteCount > 0)) && (
            <div className="flex items-center justify-end gap-2">
              {showVotes && voteCount > 0 && voteSlot === undefined && (
                <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-200">
                  {voteCount}
                </span>
              )}
              {voteSlot}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CardView = memo(CardViewComponent);

export type { CardViewProps };
