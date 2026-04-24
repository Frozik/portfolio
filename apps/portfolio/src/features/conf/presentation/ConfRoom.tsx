import { useFunction } from '@frozik/components/hooks/useFunction';
import { assert } from '@frozik/utils/assert/assert';
import copy from 'copy-to-clipboard';
import { Share2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import { cn } from '../../../shared/lib/cn';
import { Sparkline } from '../../../shared/ui/Sparkline';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useConfLobbyStore } from '../application/useConfLobbyStore';
import { useConfRoomStore } from '../application/useConfRoomStore';
import { RTT_HISTORY_MAX_SAMPLES } from '../domain/constants';
import type { RoomId } from '../domain/types';
import { ArToggleButton } from './components/ArToggleButton';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LeaveButton } from './components/LeaveButton';
import { MuteControls } from './components/MuteControls';
import { QualityBadge } from './components/QualityBadge';
import { ShareLinkDialog } from './components/ShareLinkDialog';
import { VideoTile } from './components/VideoTile';
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

  const roomStore = useConfRoomStore(typedRoomId);
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

  const handleCopyLink = useFunction(() => {
    copy(window.location.href);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <ConnectionBanner
        state={roomStore.connectionState}
        hasRemotePeer={roomStore.remoteStream !== null}
        errorMessage={roomStore.errorMessage}
      />

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
          <ArToggleButton isArEnabled={roomStore.isArEnabled} onToggle={roomStore.toggleAr} />
          {roomStore.connectionState === 'connected' && (
            <>
              <QualityBadge tier={roomStore.qualityTier} />
              {roomStore.rttHistoryMs.length >= 2 && (
                <Tooltip
                  title={`RTT ${roomStore.rttHistoryMs[roomStore.rttHistoryMs.length - 1]?.toFixed(
                    RTT_TOOLTIP_DECIMALS
                  )} ms`}
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
        onCopy={handleCopyLink}
      />
    </div>
  );
});
