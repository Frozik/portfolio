import { memo } from 'react';
import type { TEmotion } from '../../domain/emotion';
import { emotionToEmoji } from '../../domain/emotion';

export interface IEmotionBadgeProps {
  readonly emotion: TEmotion;
}

const EmotionBadgeComponent = ({ emotion }: IEmotionBadgeProps) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-2xl leading-none"
  >
    {emotionToEmoji(emotion)}
  </div>
);

export const EmotionBadge = memo(EmotionBadgeComponent);
