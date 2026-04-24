import { useFunction } from '@frozik/components/hooks/useFunction';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { confT } from '../translations';

const ICON_SIZE = 18;

export interface IMuteControlsProps {
  readonly isAudioMuted: boolean;
  readonly isVideoMuted: boolean;
  readonly onToggleAudio: () => void;
  readonly onToggleVideo: () => void;
}

const buttonBaseClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border ' +
  'text-text transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500';

const MuteControlsComponent = ({
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
}: IMuteControlsProps) => {
  const handleToggleAudio = useFunction(() => {
    onToggleAudio();
  });

  const handleToggleVideo = useFunction(() => {
    onToggleVideo();
  });

  const audioLabel = isAudioMuted ? confT.room.unmuteAudio : confT.room.muteAudio;
  const videoLabel = isVideoMuted ? confT.room.unmuteVideo : confT.room.muteVideo;

  return (
    <div className="flex items-center gap-2">
      <Tooltip title={audioLabel} placement="top">
        <button
          type="button"
          aria-label={audioLabel}
          onClick={handleToggleAudio}
          className={cn(
            buttonBaseClass,
            isAudioMuted
              ? 'bg-error/20 text-error hover:bg-error/30'
              : 'bg-surface-elevated hover:bg-surface-overlay'
          )}
        >
          {isAudioMuted ? <MicOff size={ICON_SIZE} /> : <Mic size={ICON_SIZE} />}
        </button>
      </Tooltip>
      <Tooltip title={videoLabel} placement="top">
        <button
          type="button"
          aria-label={videoLabel}
          onClick={handleToggleVideo}
          className={cn(
            buttonBaseClass,
            isVideoMuted
              ? 'bg-error/20 text-error hover:bg-error/30'
              : 'bg-surface-elevated hover:bg-surface-overlay'
          )}
        >
          {isVideoMuted ? <VideoOff size={ICON_SIZE} /> : <Video size={ICON_SIZE} />}
        </button>
      </Tooltip>
    </div>
  );
};

export const MuteControls = memo(MuteControlsComponent);
