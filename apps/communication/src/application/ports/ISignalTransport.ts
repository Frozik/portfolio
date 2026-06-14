import type { ISignalEventOutbound } from '@frozik/communication-protocol/messages';
import type { RoomId, SocketId } from '../../domain/types';

export interface ISignalTransport {
  broadcastSignalEvent(
    roomId: RoomId,
    fromSocketId: SocketId,
    event: ISignalEventOutbound
  ): Promise<{ recipientCount: number }>;
}
