import { useFunction } from '@frozik/components';
import { assert } from '@frozik/utils';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Alert, Spinner } from '../../../shared/ui';
import { useIdentityStore } from '../application/useIdentityStore';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { useRoomStore } from '../application/useRoomStore';
import { getTemplateById } from '../domain/templates';
import type { RoomId } from '../domain/types';
import { ERetroPhase } from '../domain/types';
import { ColumnList } from './components/ColumnList';
import { DiscussPanel } from './components/DiscussPanel';
import { EmptyRoomHint } from './components/EmptyRoomHint';
import { ExportDialog } from './components/ExportDialog';
import { IdentityDialog } from './components/IdentityDialog';
import { RoomHeader } from './components/RoomHeader';
import { ShareLinkDialog } from './components/ShareLinkDialog';
import { useAwarenessPresence } from './hooks/useAwarenessPresence';
import { useRetroSound } from './hooks/useRetroSound';
import { useTimerTick } from './hooks/useTimerTick';
import { retroEnTranslations as t } from './translations/en';

export const Room = observer(() => {
  const { roomId } = useParams();
  assert(roomId !== undefined && roomId.length > 0, 'roomId is required');
  const typedRoomId = roomId as RoomId;

  const identityStore = useIdentityStore();
  const lobbyStore = useRetroLobbyStore();

  // If this Room was just navigated-to from the lobby's Create action, the
  // lobby store holds the template/name/votes so that `initRetroDoc` runs
  // here and the creator is recorded as the facilitator. Consumed once.
  const createIfMissing = useMemo(() => {
    const pending = lobbyStore.getPendingCreate(typedRoomId);
    if (pending === null) {
      return null;
    }
    return {
      name: pending.name,
      template: getTemplateById(pending.template),
      votesPerParticipant: pending.votesPerParticipant,
    };
  }, [lobbyStore, typedRoomId]);

  const roomStore = useRoomStore({
    roomId: typedRoomId,
    identity: identityStore.identity,
    createIfMissing,
  });
  const [searchParams, setSearchParams] = useSearchParams();

  useTimerTick(roomStore);
  useRetroSound(roomStore);
  useAwarenessPresence(roomStore, identityStore);

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      roomStore.openShareDialog();
      const next = new URLSearchParams(searchParams);
      next.delete('created');
      setSearchParams(next, { replace: true });
    }
  }, [roomStore, searchParams, setSearchParams]);

  const snapshotMeta = roomStore.currentSnapshot?.meta;
  const participantCount = roomStore.presentUsers.length;
  useEffect(() => {
    if (snapshotMeta === undefined) {
      return;
    }
    void lobbyStore.upsertJoinedRoom({
      roomId: typedRoomId,
      name: snapshotMeta.name,
      template: snapshotMeta.template,
      createdAt: snapshotMeta.createdAt,
      facilitatorClientId: snapshotMeta.facilitatorClientId,
      facilitatorName: snapshotMeta.facilitatorName,
      participantCount,
    });
  }, [
    lobbyStore,
    typedRoomId,
    snapshotMeta?.name,
    snapshotMeta?.template,
    snapshotMeta?.createdAt,
    snapshotMeta?.facilitatorClientId,
    snapshotMeta?.facilitatorName,
    participantCount,
    snapshotMeta,
  ]);

  const handleIdentitySubmit = useFunction((params: { name: string; color: string }) => {
    identityStore.setName(params.name);
    identityStore.setColor(params.color);
    roomStore.unlockChime();
  });

  const handleCopyLink = useFunction(() => {
    void navigator.clipboard.writeText(window.location.href);
    roomStore.showToast(t.room.linkCopied);
  });

  if (!identityStore.hasName) {
    return (
      <IdentityDialog
        open
        initialName={identityStore.identity.name}
        initialColor={identityStore.identity.color}
        onSubmit={handleIdentitySubmit}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6 text-text">
      {roomStore.connectionStatus === 'connecting' && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {roomStore.lastToast !== null && <Alert type="info" message={roomStore.lastToast.message} />}

      <RoomHeader store={roomStore} />

      <EmptyRoomHint store={roomStore} />

      <ColumnList store={roomStore} />

      {roomStore.phase === ERetroPhase.Discuss && <DiscussPanel store={roomStore} />}

      {roomStore.phase === ERetroPhase.Close && <ExportDialogAutoOpen store={roomStore} />}

      <ExportDialog store={roomStore} />

      <ShareLinkDialog
        open={roomStore.isShareDialogOpen}
        onClose={roomStore.closeShareDialog}
        url={window.location.href}
        onCopy={handleCopyLink}
      />
    </div>
  );
});

const ExportDialogAutoOpen = observer(
  ({ store }: { readonly store: ReturnType<typeof useRoomStore> }) => {
    useEffect(() => {
      if (!store.isExportDialogOpen) {
        store.openExportDialog();
      }
    }, [store]);
    return null;
  }
);
