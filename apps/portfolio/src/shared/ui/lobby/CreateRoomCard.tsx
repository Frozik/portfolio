import { Plus } from 'lucide-react';
import { memo } from 'react';

import { CardFrame } from '../CardFrame';
import { MonoKicker } from '../MonoKicker';

interface CreateRoomCardProps {
  readonly kicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly buttonLabel: string;
  readonly onAction: () => void;
}

/**
 * Shared "start a new room" lobby card. Visual is identical across retro and
 * conf; only the click behaviour (dialog vs. immediate create) differs, hence
 * the single `onAction` callback.
 */
const CreateRoomCardComponent = ({
  kicker,
  title,
  subtitle,
  buttonLabel,
  onAction,
}: CreateRoomCardProps) => (
  <CardFrame>
    <div className="flex items-center justify-between gap-4 px-6 py-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-landing-accent/40 text-landing-accent">
          <Plus size={14} />
        </div>
        <div className="min-w-0">
          <MonoKicker tone="faint">{kicker}</MonoKicker>
          <div className="mt-1 text-sm font-medium text-landing-fg">{title}</div>
          <div className="mt-0.5 font-mono text-[11px] text-landing-fg-faint">{subtitle}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 border-0 bg-landing-accent px-4 py-2 font-mono text-xs font-medium text-landing-bg transition-opacity hover:opacity-90"
      >
        {buttonLabel} →
      </button>
    </div>
  </CardFrame>
);

export const CreateRoomCard = memo(CreateRoomCardComponent);
