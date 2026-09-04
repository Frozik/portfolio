import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { Share2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import { useAnonymousCommunicationClient } from '../../../shared/communication/useCommunicationClient';
import { ShareLinkDialog } from '../../../shared/ui/ShareLinkDialog';
import { Sparkline } from '../../../shared/ui/Sparkline';
import { Spinner } from '../../../shared/ui/Spinner';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useConfLobbyStore } from '../application/useConfLobbyStore';
import { useConfRoomStore } from '../application/useConfRoomStore';
import { RTT_HISTORY_MAX_SAMPLES } from '../domain/constants';
import type { RoomId } from '../domain/types';
import { ConnectionBanner } from './components/ConnectionBanner';
import { GlassesPickerButton } from './components/GlassesPickerButton';
import { LeaveButton } from './components/LeaveButton';
import { MuteControls } from './components/MuteControls';
import { QualityBadge } from './components/QualityBadge';
import { VideoTile } from './components/VideoTile';
import { GLASSES_ASSET_URLS } from './glasses-assets';
import { confT } from './translations';

const SHARE_ICON_SIZE = 18;
const CREATED_QUERY_FLAG = 'created';
const LOBBY_PATH = '/conf';

const RTT_SPARKLINE_WIDTH_PX = 60;
const RTT_SPARKLINE_HEIGHT_PX = 20;
const RTT_TOOLTIP_DECIMALS = 0;

const shareButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border ' +
  'bg-surface-elevated text-text transition-colors hover:bg-surface-overlay ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export const ConfRoom = observer(() => {
  const { roomId } = useParams();
  assert(roomId !== undefined && roomId.length > 0, 'roomId is required');
  const typedRoomId = roomId as RoomId;

  // Pass the bare UUID — the server's HandshakeAuthSchema requires
  // `auth.roomId` to be UUID v4. The CONF_ROOM_ID_NETWORK_PREFIX
  // lives on the in-payload signaling topic (see conf-signaling-client),
  // not on the server-visible roomId. The anonymous variant skips OIDC
  // sign-in entirely — conf rooms are open by URL.
  const client = useAnonymousCommunicationClient(typedRoomId);
  if (client === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <ConfRoomBody typedRoomId={typedRoomId} client={client} />;
});

const ConfRoomBody = observer(
  ({
    typedRoomId,
    client,
  }: {
    readonly typedRoomId: RoomId;
    readonly client: ICommunicationClient;
  }) => {
    const roomStore = useConfRoomStore(typedRoomId, client, GLASSES_ASSET_URLS);
    const lobbyStore = useConfLobbyStore();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
      void roomStore.join();
    }, [roomStore]);

    useEffect(() => {
      void lobbyStore.touchVisited(typedRoomId);
    }, [lobbyStore, typedRoomId]);

    useEffect(() => {
      if (searchParams.get(CREATED_QUERY_FLAG) === '1') {
        roomStore.openShareDialog();
        const next = new URLSearchParams(searchParams);
        next.delete(CREATED_QUERY_FLAG);
        setSearchParams(next, { replace: true });
      }
    }, [roomStore, searchParams, setSearchParams]);

    const handleLeave = useFunction(() => {
      roomStore.leave();
      void navigate(LOBBY_PATH);
    });

    useRegisterTopNavBack({
      label: confT.room.backToLobby,
      onActivate: handleLeave,
    });

    const handleOpenShare = useFunction(() => {
      roomStore.openShareDialog();
    });

    const handleCloseShare = useFunction(() => {
      roomStore.closeShareDialog();
    });

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ConnectionBanner
              state={roomStore.connectionState}
              hasRemotePeer={!isNil(roomStore.remoteStream)}
              errorMessage={roomStore.errorMessage}
              hasStaleTurnCredentials={roomStore.hasStaleTurnCredentials}
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          <VideoTile
            stream={roomStore.localStream}
            isLocal
            isVideoMuted={roomStore.isVideoMuted}
            placeholderLabel={confT.room.localLabel}
            cameraOffLabel={confT.room.cameraOffBadge}
            emotion={roomStore.isArEnabled ? roomStore.localEmotion : undefined}
          />
          <VideoTile
            stream={roomStore.remoteStream}
            isLocal={false}
            isVideoMuted={false}
            placeholderLabel={confT.room.remoteLabel}
            cameraOffLabel={confT.room.cameraOffBadge}
            emotion={roomStore.isArEnabled ? roomStore.remoteEmotion : undefined}
          />
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <div
            className={cn(
              'flex items-center gap-3 rounded-full border border-border',
              'bg-surface-elevated/90 px-4 py-2 shadow-lg backdrop-blur-sm'
            )}
          >
            <MuteControls
              isAudioMuted={roomStore.isAudioMuted}
              isVideoMuted={roomStore.isVideoMuted}
              onToggleAudio={roomStore.toggleAudio}
              onToggleVideo={roomStore.toggleVideo}
            />
            <GlassesPickerButton
              selectedStyle={roomStore.glassesStyle}
              onSelectStyle={roomStore.setGlassesStyle}
            />
            {roomStore.connectionState === 'connected' && (
              <>
                <QualityBadge tier={roomStore.qualityTier} />
                {roomStore.rttHistoryMs.length >= 2 && (
                  <Tooltip
                    title={`RTT ${roomStore.rttHistoryMs[
                      roomStore.rttHistoryMs.length - 1
                    ]?.toFixed(RTT_TOOLTIP_DECIMALS)} ms`}
                    placement="top"
                  >
                    <Sparkline
                      data={roomStore.rttHistoryMs}
                      viewBoxWidth={RTT_SPARKLINE_WIDTH_PX}
                      viewBoxHeight={RTT_SPARKLINE_HEIGHT_PX}
                      maxPoints={RTT_HISTORY_MAX_SAMPLES}
                      invertTrend
                      className="shrink-0"
                    />
                  </Tooltip>
                )}
              </>
            )}
            <Tooltip title={confT.room.share} placement="top">
              <button
                type="button"
                aria-label={confT.room.share}
                onClick={handleOpenShare}
                className={shareButtonClass}
              >
                <Share2 size={SHARE_ICON_SIZE} />
              </button>
            </Tooltip>
            <LeaveButton onLeave={handleLeave} />
          </div>
        </div>

        <ShareLinkDialog
          open={roomStore.isShareDialogOpen}
          onClose={handleCloseShare}
          url={window.location.href}
          kicker={confT.share.kicker}
          title={confT.share.dialogTitle}
          description={confT.share.description}
          qrLabel={confT.share.qrLabel}
          copyLabel={confT.share.copyLink}
          copiedLabel={confT.share.copied}
          copyFailedLabel={confT.errors.copyFailed}
        />
      </div>
    );
  }
);
