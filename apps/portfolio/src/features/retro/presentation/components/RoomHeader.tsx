import { useFunction } from '@frozik/components';
import { Copy, FileText, Share2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { useUserDirectoryStore } from '../../application/useUserDirectoryStore';
import { ERetroPhase } from '../../domain/types';
import { writeTextToClipboard } from '../../infrastructure/clipboard';
import { retroEnTranslations as t } from '../translations/en';
import { FacilitatorMenu } from './FacilitatorMenu';
import { PhaseStepper } from './PhaseStepper';
import { PresenceBar } from './PresenceBar';
import { Timer } from './Timer';

interface RoomHeaderProps {
  readonly store: RoomStore;
}

export const RoomHeader = observer(({ store }: RoomHeaderProps) => {
  const directory = useUserDirectoryStore();
  const name = store.currentSnapshot?.meta.name ?? t.lobby.title;

  const handleCopyLink = useFunction(() => {
    void writeTextToClipboard(window.location.href).then(
      () => store.showToast(t.room.linkCopied),
      () => store.showToast(t.errors.copyFailed)
    );
  });

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-text">{name}</h1>
          {facilitatorName.length > 0 && (
            <span className="text-xs text-text-muted">
              {t.lobby.ownerLabel}: {facilitatorName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Timer store={store} />
          <PresenceBar store={store} />
          {store.phase === ERetroPhase.Close && (
            <Button variant="secondary" size="sm" onClick={handleOpenResults}>
              <FileText size={14} /> {t.close.viewResults}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            <Copy size={14} /> {t.room.copyLink}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenShareDialog}>
            <Share2 size={14} />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PhaseStepper store={store} />
      </div>
      <FacilitatorMenu store={store} />
    </header>
  );
});
