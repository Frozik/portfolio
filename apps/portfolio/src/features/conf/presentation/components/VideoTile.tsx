import { observer } from 'mobx-react-lite';
import { memo, useEffect, useRef } from 'react';

import { cn } from '../../../../shared/lib/cn';
import type { TEmotion } from '../../domain/emotion';
import { EmotionBadge } from './EmotionBadge';

export interface IVideoTileProps {
  readonly stream: MediaStream | null;
  readonly isLocal: boolean;
  readonly isVideoMuted: boolean;
  readonly placeholderLabel: string;
  readonly cameraOffLabel: string;
  readonly emotion?: TEmotion;
}

const VideoTileComponent = observer((props: IVideoTileProps) => {
  const { stream, isLocal, isVideoMuted, placeholderLabel, cameraOffLabel, emotion } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement === null) {
      return;
    }
    videoElement.srcObject = stream;
    return () => {
      if (videoElement.srcObject === stream) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  const showCameraOffBadge = isLocal && isVideoMuted;
  const showWaitingPlaceholder = stream === null;

  return (
    <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          'h-full w-full object-cover',
          isLocal && 'scale-x-[-1]',
          showCameraOffBadge && 'invisible'
        )}
        aria-label={placeholderLabel}
      />
      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        {placeholderLabel}
      </div>
      {emotion !== undefined && <EmotionBadge emotion={emotion} />}
      {showCameraOffBadge && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-sm text-text-muted">
          {cameraOffLabel}
        </div>
      )}
      {showWaitingPlaceholder && !showCameraOffBadge && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-text-muted">
          {placeholderLabel}
        </div>
      )}
    </div>
  );
});

export const VideoTile = memo(VideoTileComponent);
