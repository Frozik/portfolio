import {
  Check,
  Crosshair,
  Flag,
  Globe,
  Locate,
  LocateFixed,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import type { Following } from '../../application/CourseView';
import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';
import { ForesightStatus } from './ForesightStatus';
import { GripStatus } from './GripStatus';

const ICON_SIZE_PX = 16;
/** The ball button shows how the ball is kept: at the edge, centred at rest, centred always. */
const FOLLOWING_ICON: Readonly<Record<Following, ComponentType<{ readonly size: number }>>> = {
  edge: Locate,
  rest: LocateFixed,
  always: Crosshair,
};
/** A reset asked for stays armed this long, waiting for the second press that confirms it. */
const RESET_CONFIRM_MILLISECONDS = 3000;
const BUTTON_CLASS =
  'pointer-events-auto flex size-9 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 shadow-lg transition-all hover:scale-110 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30';

const HudButton = ({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  readonly icon: ComponentType<{ readonly size: number }>;
  readonly label: string;
  readonly onClick: VoidFunction;
  readonly className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cn(BUTTON_CLASS, className)}
  >
    <Icon size={ICON_SIZE_PX} />
  </button>
);

/** A new world is two presses: the first arms the button, the second within a few seconds does it. */
const ResetWorldButton = ({ onReset }: { readonly onReset: VoidFunction }) => {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) {
      return undefined;
    }
    const timer = window.setTimeout(() => setArmed(false), RESET_CONFIRM_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const press = useEventCallback(() => {
    if (armed) {
      onReset();
    }
    setArmed(!armed);
  });

  return (
    <HudButton
      icon={armed ? Check : Globe}
      label={armed ? spaceGolfT.hud.resetConfirm : spaceGolfT.hud.reset}
      onClick={press}
      className={armed ? 'bg-red-800 text-white' : undefined}
    />
  );
};

/** The counters — holes played, strokes over all of them plus those since the last — and the ways to look around and to start the world over. */
export const Hud = observer(({ store }: { readonly store: SpaceGolfStore }) => (
  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-sm text-neutral-200">
    <span className="flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 tabular-nums">
      <Flag size={ICON_SIZE_PX} aria-hidden="true" />
      {spaceGolfT.hud.holes(store.holes)}
    </span>
    <span className="rounded bg-black/50 px-2 py-1 tabular-nums">
      {spaceGolfT.hud.strokes(store.totalStrokes, store.strokesSinceHole)}
    </span>
    <span className="flex flex-wrap-reverse items-center justify-end gap-2">
      <span className="flex items-center gap-1">
        <GripStatus store={store} />
        <ForesightStatus store={store} />
      </span>
      <span className="flex gap-2">
        <HudButton
          icon={FOLLOWING_ICON[store.view.following]}
          label={spaceGolfT.hud.following[store.view.following]}
          onClick={store.view.centerOnBall}
        />
        <HudButton
          icon={store.view.isOverview ? Minimize2 : Maximize2}
          label={store.view.isOverview ? spaceGolfT.hud.closeUp : spaceGolfT.hud.overview}
          onClick={store.view.toggleOverview}
        />
        <ResetWorldButton onReset={store.resetWorld} />
      </span>
    </span>
  </div>
));
