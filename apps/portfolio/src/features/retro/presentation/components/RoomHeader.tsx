import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Eye, Share2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { RoomStore } from '../../application/RoomStore';
import { useUserDirectoryStore } from '../../application/useUserDirectoryStore';
import { retroT } from '../translations';
import { PhaseStepper } from './PhaseStepper';
import { PresencePanel } from './PresencePanel';
import { Timer } from './Timer';

const ICON_BUTTON_CLASSES =
  'inline-flex h-[26px] w-[26px] items-center justify-center border border-landing-border-soft text-landing-fg-dim transition-colors hover:border-landing-accent/30 hover:text-landing-fg';

/**
 * Sticky top bar for the Room — mirrors the three-column grid from
 * `apps/retro/board.jsx` TopBar + PhaseProgress: identity on the left
 * (back link, room name, facilitator), Timer in the middle, Presence on
 * the right. A second row under the bar hosts the PhaseStepper and,
 * where relevant, per-phase action icons (Share / Results).
 */
export const RoomHeader = observer(({ store }: { readonly store: RoomStore }) => {
  const directory = useUserDirectoryStore();
  const snapshot = store.currentSnapshot;
  const name = snapshot?.meta.name ?? retroT.lobby.title;

  const facilitatorClientId = snapshot?.meta.facilitatorClientId;
  const facilitatorProfile = isNil(facilitatorClientId)
    ? undefined
    : directory.get(facilitatorClientId);
  const facilitatorDisplayName =
    (facilitatorProfile?.name ?? '').trim() !== ''
      ? (facilitatorProfile?.name ?? '')
      : (snapshot?.meta.facilitatorName.trim() ?? '');
  const handleOpenShareDialog = useFunction(() => store.showDialog('share'));
  const handleOpenResults = useFunction(() => store.showDialog('export'));

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-landing-border-soft bg-landing-bg/70 px-4 py-3.5 backdrop-blur-md sm:px-6">
      <div className="flex items-start gap-4">
        {/*
         * Two-column outer flex:
         *   1. Content (flex-1, wraps internally) — hosts room-info
         *      (can shrink, never grows) and Timer (grows, never shrinks;
         *      its min-content enforces wrap to a new row once the
         *      remaining space no longer fits it).
         *   2. Presence — fixed width, never shrinks or grows, so it
         *      always sits at the right edge of the first row.
         *
         * Outer uses items-start + a shared min-h on all three slots
         * (room-info / Timer wrapper / Presence wrapper) so that when
         * Timer wraps to a new row, Presence stays vertically centered
         * relative to the first row (not the expanded total height).
         */}
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
          <div className="flex min-h-9 min-w-0 grow-0 items-center gap-3.5">
            <MonoKicker tone="faint" className="shrink-0">
              {retroT.lobby.roomKicker}
            </MonoKicker>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate text-[15px] leading-tight font-medium text-landing-fg">
                {name}
              </h1>
              {facilitatorDisplayName.length > 0 && (
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-landing-fg-faint">
                  <span className="truncate">
                    {retroT.lobby.hostedBy}{' '}
                    <span className="text-landing-fg-dim">{facilitatorDisplayName}</span>
                  </span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenShareDialog}
              aria-label={retroT.room.shareLinkTitle}
              title={retroT.room.shareLinkTitle}
              className={cn(ICON_BUTTON_CLASSES, 'shrink-0')}
            >
              <Share2 size={12} />
            </button>
            {store.phase === 'close' && (
              <button
                type="button"
                onClick={handleOpenResults}
                aria-label={retroT.room.viewResultsTitle}
                title={retroT.room.viewResultsTitle}
                className={cn(ICON_BUTTON_CLASSES, 'shrink-0')}
              >
                <Eye size={12} />
              </button>
            )}
          </div>
          <div className="flex min-h-9 flex-1 shrink-0 items-center justify-center">
            <Timer store={store} />
          </div>
        </div>
        <div className="flex min-h-9 shrink-0 grow-0 items-center">
          <PresencePanel store={store} />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-landing-border-soft pt-3">
        <PhaseStepper store={store} />
      </div>
    </header>
  );
});
