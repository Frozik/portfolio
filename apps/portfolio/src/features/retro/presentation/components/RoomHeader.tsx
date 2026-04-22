import { useFunction } from '@frozik/components';
import { ArrowLeft, FileText, Share2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { useUserDirectoryStore } from '../../application/useUserDirectoryStore';
import { ERetroPhase } from '../../domain/types';
import { retroT as t } from '../translations';
import { PhaseStepper } from './PhaseStepper';
import { PresencePanel } from './PresencePanel';
import { Timer } from './Timer';

interface RoomHeaderProps {
  readonly store: RoomStore;
}

export const RoomHeader = observer(({ store }: RoomHeaderProps) => {
  const directory = useUserDirectoryStore();
  const name = store.currentSnapshot?.meta.name ?? t.lobby.title;

  const handleOpenShareDialog = useFunction(() => store.openShareDialog());
  const handleOpenResults = useFunction(() => store.openExportDialog());

  const facilitatorClientId = store.currentSnapshot?.meta.facilitatorClientId ?? null;
  const facilitatorName =
    facilitatorClientId !== null
      ? directory.getName(facilitatorClientId).trim() ||
        (store.currentSnapshot?.meta.facilitatorName?.trim() ?? '')
      : '';

  return (
    <header className="flex flex-col gap-3 border-b border-border pb-3">
      {/* Row 1: back + title/facilitator (left) + full timer block (right).
          flex-wrap lets the Timer drop to a separate row when the header
          is too narrow to hold both side-by-side. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <NavLink
            to="/retro"
            aria-label={t.close.backToLobby}
            title={t.close.backToLobby}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text"
          >
            <ArrowLeft size={16} />
          </NavLink>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="min-w-0 break-words text-lg font-bold text-text sm:text-2xl">
                {name}
              </h1>
              <button
                type="button"
                onClick={handleOpenShareDialog}
                aria-label={t.share.dialogTitle}
                title={t.share.dialogTitle}
                className="shrink-0 text-text-muted transition-colors hover:text-brand-300"
              >
                <Share2 size={18} />
              </button>
            </div>
            {facilitatorName.length > 0 && (
              <span className="text-xs text-text-muted">
                {t.lobby.ownerLabel}: {facilitatorName}
              </span>
            )}
          </div>
        </div>
        <Timer store={store} />
      </div>

      <PresencePanel store={store} />

      {store.phase === ERetroPhase.Close && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleOpenResults}>
            <FileText size={14} /> {t.close.viewResults}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PhaseStepper store={store} />
      </div>
    </header>
  );
});
