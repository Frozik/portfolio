import type { IRetroCard } from '../../domain/types';

interface CardDragPreviewProps {
  card: IRetroCard;
}

export const CardDragPreview = ({ card }: CardDragPreviewProps) => {
  return (
    <div className="pointer-events-none w-full max-w-[320px] min-w-[200px] rotate-1 cursor-grabbing border border-landing-accent/60 bg-landing-bg-card px-3.5 py-3 text-[13px] leading-[1.5] text-landing-fg shadow-xl shadow-black/60">
      <p className="m-0 whitespace-pre-wrap break-words">{card.text}</p>
    </div>
  );
};
