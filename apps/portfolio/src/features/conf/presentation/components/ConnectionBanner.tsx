import { assertNever } from '@frozik/utils';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import type { TConfRoomConnectionState } from '../../application/ConfRoomStore';
import { confT } from '../translations';

export interface IConnectionBannerProps {
  readonly state: TConfRoomConnectionState;
  readonly hasRemotePeer: boolean;
  readonly errorMessage: string | null;
}

interface IBannerContent {
  readonly text: string;
  readonly tone: 'info' | 'warn' | 'error';
}

function resolveBannerContent(
  state: TConfRoomConnectionState,
  hasRemotePeer: boolean,
  errorMessage: string | null
): IBannerContent | null {
  switch (state) {
    case 'idle':
    case 'acquiring-media':
      return { text: confT.room.acquiringMedia, tone: 'info' };
    case 'connecting':
      return hasRemotePeer
        ? { text: confT.room.connecting, tone: 'info' }
        : { text: confT.room.waitingForPeer, tone: 'info' };
    case 'connected':
      return null;
    case 'peer-disconnected':
      return { text: confT.room.peerDisconnected, tone: 'warn' };
    case 'room-full':
      return { text: confT.room.roomFullDescription, tone: 'error' };
    case 'error':
      return {
        text:
          errorMessage !== null && errorMessage.length > 0 ? errorMessage : confT.room.errorDefault,
        tone: 'error',
      };
    default:
      assertNever(state);
  }
}

const toneClassMap: Record<IBannerContent['tone'], string> = {
  info: 'bg-surface-elevated text-text border-border',
  warn: 'bg-amber-500/10 text-amber-200 border-amber-500/40',
  error: 'bg-red-500/10 text-red-200 border-red-500/40',
};

const ConnectionBannerComponent = ({
  state,
  hasRemotePeer,
  errorMessage,
}: IConnectionBannerProps) => {
  const content = resolveBannerContent(state, hasRemotePeer, errorMessage);
  if (content === null) {
    return null;
  }
  return (
    <div
      role="status"
      className={cn(
        'mx-auto max-w-xl rounded-md border px-4 py-2 text-center text-sm',
        toneClassMap[content.tone]
      )}
    >
      {content.text}
    </div>
  );
};

export const ConnectionBanner = memo(ConnectionBannerComponent);
