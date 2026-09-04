import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import type { TConfRoomConnectionState } from '../../application/ConfRoomStore';
import { confT } from '../translations';

interface IBannerContent {
  readonly text: string;
  readonly tone: 'info' | 'warn' | 'error';
}

function resolveBannerContent(
  state: TConfRoomConnectionState,
  hasRemotePeer: boolean,
  errorMessage: string | undefined,
  hasStaleTurnCredentials: boolean
): IBannerContent | undefined {
  switch (state) {
    case 'idle':
    case 'acquiring-media':
      return { text: confT.room.acquiringMedia, tone: 'info' };
    case 'connecting':
      return hasRemotePeer
        ? { text: confT.room.connecting, tone: 'info' }
        : { text: confT.room.waitingForPeer, tone: 'info' };
    case 'connected':
      return hasStaleTurnCredentials
        ? { text: confT.room.turnRenewalFailed, tone: 'warn' }
        : undefined;
    case 'peer-disconnected':
      return { text: confT.room.peerDisconnected, tone: 'warn' };
    case 'room-full':
      return { text: confT.room.roomFullDescription, tone: 'error' };
    case 'error':
      return {
        text:
          isNil(errorMessage) || errorMessage.length === 0 ? confT.room.errorDefault : errorMessage,
        tone: 'error',
      };
    default:
      return assertNever(state);
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
  hasStaleTurnCredentials,
}: {
  readonly state: TConfRoomConnectionState;
  readonly hasRemotePeer: boolean;
  readonly errorMessage: string | undefined;
  readonly hasStaleTurnCredentials: boolean;
}) => {
  const content = resolveBannerContent(state, hasRemotePeer, errorMessage, hasStaleTurnCredentials);
  if (isNil(content)) {
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
