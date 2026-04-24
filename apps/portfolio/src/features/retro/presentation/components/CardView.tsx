import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check, Pencil, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { useUserDirectoryStore } from '../../application/useUserDirectoryStore';
import { REDACTED_CARD_PLACEHOLDER } from '../../domain/constants';
import type { ClientId, ERetroPhase, IRetroCard } from '../../domain/types';
import { useCardFlipState } from '../hooks/useCardFlipState';
import styles from '../styles.module.scss';
import { retroT as t } from '../translations';

interface CardViewProps {
  card: IRetroCard;
  cardIndex: number;
  accentColor: string;
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
const CARD_INDEX_PAD_LENGTH = 3;
const CARD_INDEX_PAD_CHAR = '0';

function formatCardIndex(cardIndex: number): string {
  return String(cardIndex + 1).padStart(CARD_INDEX_PAD_LENGTH, CARD_INDEX_PAD_CHAR);
}

const CardViewComponent = ({
  card,
  cardIndex,
  accentColor,
  isOwn,
  phase,
  showVotes,
  voteCount,
  voteSlot,
  staggerIndex = 0,
  onEdit,
  onDelete,
}: CardViewProps) => {
  const directory = useUserDirectoryStore();
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

  const cardIndexLabel = formatCardIndex(cardIndex);
  const authorProfile = directory.get(card.authorClientId as ClientId);
  const authorName = (authorProfile?.name ?? '').trim();
  const authorColor = authorProfile?.color ?? null;

  return (
    <div className={cn(styles.cardFlipContainer, 'relative min-h-[96px] w-full')}>
      <div
        className={cn(
          styles.cardFlipInner,
          'relative min-h-[96px] w-full',
          isHidden && styles.cardFlipInnerHidden
        )}
        style={flipDelayStyle}
      >
        <div className={cn(styles.cardBack, 'w-full')} aria-hidden="true">
          <CardFrame className="flex min-h-[96px] w-full items-center justify-center bg-landing-bg-card/60">
            <MonoKicker tone="faint">
              #{cardIndexLabel} / {t.room.cardIndexUnknown}
            </MonoKicker>
            <span className="sr-only">
              {REDACTED_CARD_PLACEHOLDER} {t.room.cardBackLabel}
            </span>
          </CardFrame>
        </div>

        <div className={cn(styles.cardFace, 'w-full')}>
          <CardFrame
            hoverable={!isEditing}
            accentColor={accentColor}
            className="group flex min-h-[96px] w-full flex-col gap-2.5 px-3.5 py-3"
          >
            <MonoKicker tone="faint" className="tracking-[0.1em] text-landing-fg-faint/70">
              #{cardIndexLabel}
            </MonoKicker>
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleDraftKeyDown}
                  rows={2}
                  className="w-full resize-y border-0 border-b border-dashed border-landing-border-soft bg-transparent px-0 py-1 text-[13px] text-landing-fg focus:border-landing-accent focus:outline-none"
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    aria-label={t.room.cancelEdit}
                    className="inline-flex h-6 w-6 items-center justify-center border border-landing-border-soft text-landing-fg-dim transition-colors hover:border-landing-accent/30 hover:text-landing-fg"
                  >
                    <X size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    aria-label={t.room.saveCard}
                    className="inline-flex h-6 w-6 items-center justify-center border border-landing-green/40 text-landing-green transition-colors hover:bg-landing-green/10"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="m-0 flex-1 pr-4 text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-landing-fg">
                {card.text}
              </p>
            )}

            {!isEditing && (
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <div className="flex min-w-0 items-center gap-2">
                  {authorColor !== null && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      // Per-author dot color is runtime-dynamic.
                      style={{ backgroundColor: authorColor }}
                    />
                  )}
                  {authorName.length > 0 && (
                    <MonoKicker tone="dim" className="truncate">
                      {authorName}
                    </MonoKicker>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isOwn && onEdit !== undefined && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      aria-label={t.room.editCard}
                      className="inline-flex h-5 w-5 items-center justify-center border border-landing-border-soft text-landing-fg-faint opacity-0 transition-all hover:border-landing-accent/30 hover:text-landing-fg focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                  {isOwn && onDelete !== undefined && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      aria-label={t.room.deleteCard}
                      className="inline-flex h-5 w-5 items-center justify-center border border-landing-border-soft text-landing-fg-faint opacity-0 transition-all hover:border-landing-red/40 hover:text-landing-red focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X size={10} />
                    </button>
                  )}
                  {showVotes && voteCount > 0 && voteSlot === undefined && (
                    <span className="inline-flex items-center gap-1 border border-landing-accent/40 bg-landing-accent/10 px-2 py-[3px] font-mono text-[10px] text-landing-accent">
                      {voteCount}
                    </span>
                  )}
                  {voteSlot}
                </div>
              </div>
            )}
          </CardFrame>
        </div>
      </div>
    </div>
  );
};

export const CardView = memo(CardViewComponent);

export type { CardViewProps };
