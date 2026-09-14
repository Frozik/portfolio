import { ChevronLeft, ChevronRight, Flag, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

const ICON_SIZE_PX = 16;
const BUTTON_CLASS =
  'pointer-events-auto flex size-9 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 shadow-lg transition-all hover:scale-110 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30';

const HudButton = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  readonly icon: ComponentType<{ readonly size: number }>;
  readonly label: string;
  readonly onClick: VoidFunction;
  readonly disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={BUTTON_CLASS}
  >
    <Icon size={ICON_SIZE_PX} />
  </button>
);

/** The counters of the reference — the level, the strokes over all levels plus this one — with the way to the neighbouring levels and back to the tee. */
export const Hud = observer(({ store }: { readonly store: SpaceGolfStore }) => (
  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-sm text-neutral-200">
    <span className="flex items-center gap-1.5 rounded bg-black/50 px-2 py-1">
      <Flag size={ICON_SIZE_PX} aria-hidden="true" />
      {spaceGolfT.hud.level(store.levelNumber)}
    </span>
    <span className="rounded bg-black/50 px-2 py-1 tabular-nums">
      {spaceGolfT.hud.strokes(store.totalStrokes, store.strokeCount)}
    </span>
    <span className="flex gap-2">
      <HudButton
        icon={ChevronLeft}
        label={spaceGolfT.hud.previous}
        onClick={store.previousLevel}
        disabled={!store.hasPreviousLevel}
      />
      <HudButton icon={ChevronRight} label={spaceGolfT.hud.next} onClick={store.nextLevel} />
      <HudButton icon={RotateCcw} label={spaceGolfT.hud.restart} onClick={store.restart} />
    </span>
  </div>
));
