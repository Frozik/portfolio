import { useFunction } from '@frozik/components/hooks/useFunction';
import { assert } from '@frozik/utils/assert/assert';
import copy from 'copy-to-clipboard';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import { useCommunicationClient } from '../../../shared/communication/useCommunicationClient';
import { Alert } from '../../../shared/ui/Alert';
import { ShareLinkDialog } from '../../../shared/ui/ShareLinkDialog';
import { Spinner } from '../../../shared/ui/Spinner';
import { useIdentityStore } from '../application/useIdentityStore';
import { useRetroLobbyStore } from '../application/useRetroLobbyStore';
import { useRoomStore } from '../application/useRoomStore';
import { getTemplateById } from '../domain/templates';
import type { RoomId } from '../domain/types';
import { ERetroPhase } from '../domain/types';
import { ClosePanel } from './components/ClosePanel';
import { ColumnList } from './components/ColumnList';
import { DiscussPanel } from './components/DiscussPanel';
import { ExportDialog } from './components/ExportDialog';
import { RoomHeader } from './components/RoomHeader';
import { useAwarenessPresence } from './hooks/useAwarenessPresence';
import { useTimerTick } from './hooks/useTimerTick';
import { retroT as t } from './translations';

export const Room = observer(() => {
  const { roomId } = useParams();
  assert(roomId !== undefined && roomId.length > 0, 'roomId is required');
  const typedRoomId = roomId as RoomId;

  // Pass the bare UUID — the server's HandshakeAuthSchema requires
  // `auth.roomId` to be UUID v4. ROOM_ID_NETWORK_PREFIX lives on the
  // y-webrtc *topic* (see yjs-providers.ts) where it disambiguates
  // retro from conf inside the signaling adapter; the server never
  // sees the topic, only the UUID we send here.
  const client = useCommunicationClient(typedRoomId);
  if (client === null) {
    // The communication socket is mid-handshake (the SignInGate
    // ancestor has already established the user is signed in).
    // Render a spinner so feature-specific stores aren't built
    // against a half-initialised client.
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <RoomBody typedRoomId={typedRoomId} client={client} />;
});

const RoomBody = observer(
  ({
    typedRoomId,
    client,
  }: {
    readonly typedRoomId: RoomId;
    readonly client: ICommunicationClient;
  }) => {
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
      client,
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    useTimerTick(roomStore);
    useAwarenessPresence(roomStore, identityStore);

    const handleBackToLobby = useFunction(() => {
      void navigate('/retro');
    });
    useRegisterTopNavBack({
      label: t.room.backToLobbyLabel,
      onActivate: handleBackToLobby,
    });

    // Resume the shared AudioContext on the first user gesture inside the
    // room. Browsers keep it suspended until a real interaction, otherwise
    // countdown beeps stay silent for participants who joined by link
    // (i.e. never went through the identity dialog where `unlockChime` was
    // originally wired).
    useEffect(() => {
      const unlock = (): void => {
        roomStore.unlockChime();
      };
      document.addEventListener('pointerdown', unlock, { once: true });
      document.addEventListener('keydown', unlock, { once: true });
      return () => {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
    }, [roomStore]);

    useEffect(() => {
      if (searchParams.get('created') === '1') {
        roomStore.openShareDialog();
        const next = new URLSearchParams(searchParams);
        next.delete('created');
        setSearchParams(next, { replace: true });
      }
    }, [roomStore, searchParams, setSearchParams]);

    const snapshotMeta = roomStore.currentSnapshot?.meta;
    const presentUsers = roomStore.presentUsers;
    const participantCount = presentUsers.length;
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
        phase: snapshotMeta.phase,
        presentParticipantIds: presentUsers.map(user => user.clientId),
      });
    }, [
      lobbyStore,
      typedRoomId,
      snapshotMeta?.name,
      snapshotMeta?.template,
      snapshotMeta?.createdAt,
      snapshotMeta?.facilitatorClientId,
      snapshotMeta?.facilitatorName,
      snapshotMeta?.phase,
      participantCount,
      presentUsers,
      snapshotMeta,
    ]);

    const handleCopyLink = useFunction(async () => {
      const copied = await copy(window.location.href);
      roomStore.showToast(copied ? t.room.linkCopied : t.errors.copyFailed);
    });

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto text-landing-fg">
        {roomStore.connectionStatus === 'connecting' && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {roomStore.lastToast !== null && (
          <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
            <div className="pointer-events-auto max-w-md shadow-lg shadow-black/40">
              <Alert type="info" message={roomStore.lastToast.message} />
            </div>
          </div>
        )}

        <RoomHeader store={roomStore} />

        <div className="flex flex-col gap-4 px-4 pt-4 pb-6 sm:px-6 sm:pt-6">
          <ColumnList store={roomStore} />

          {roomStore.phase === ERetroPhase.Discuss && <DiscussPanel store={roomStore} />}
          {roomStore.phase === ERetroPhase.Close && <ClosePanel store={roomStore} />}
        </div>

        {roomStore.phase === ERetroPhase.Close && <ExportDialogAutoOpen store={roomStore} />}

        <ExportDialog store={roomStore} />

        <ShareLinkDialog
          open={roomStore.isShareDialogOpen}
          onClose={roomStore.closeShareDialog}
          url={window.location.href}
          onCopy={handleCopyLink}
          kicker={t.share.kicker}
          title={t.share.dialogTitle}
          description={t.share.description}
          qrLabel={t.share.qrLabel}
          copyLabel={t.share.copyLink}
          copiedLabel={t.share.copied}
        />
      </div>
    );
  }
);

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
