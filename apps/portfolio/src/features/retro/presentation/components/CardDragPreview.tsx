import type { IRetroCard } from '../../domain/types';

interface CardDragPreviewProps {
  card: IRetroCard;
}

export const CardDragPreview = ({ card }: CardDragPreviewProps) => {
  return (
    <div className="pointer-events-none w-full min-w-[200px] max-w-[320px] cursor-grabbing rounded-md border border-brand-400 bg-surface-elevated p-3 text-sm text-text shadow-lg shadow-black/40">
      <p className="whitespace-pre-wrap break-words">{card.text}</p>
    </div>
  );
};
