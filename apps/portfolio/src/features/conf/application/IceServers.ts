import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';

export type TurnCredentialsSource = Pick<ICommunicationClient, 'requestTurnCredentials'>;

/**
 * The ICE servers a call negotiates through. Host-only ICE is enough for LAN
 * calls, so a missing TURN server is not fatal; a renewal that fails leaves the
 * call running on credentials that will expire, which is what `isStale` says.
 */
export class IceServers {
  current: readonly RTCIceServer[] = [];
  /** The last TURN renewal failed; the call keeps running on credentials that will expire. */
  isStale = false;

  private readonly source: TurnCredentialsSource;

  constructor(source: TurnCredentialsSource) {
    this.source = source;
    makeAutoObservable<IceServers, 'source'>(this, { source: false }, { autoBind: true });
  }

  /** The first fetch, before the call starts; nothing when the TURN server is unreachable. */
  async fetch(): Promise<readonly RTCIceServer[] | undefined> {
    const turn = await this.source.requestTurnCredentials().catch(() => undefined);
    if (isNil(turn)) {
      return undefined;
    }
    return [{ urls: [...turn.urls], username: turn.username, credential: turn.credential }];
  }

  adopt(servers: readonly RTCIceServer[] | undefined): void {
    this.current = servers ?? [];
  }

  /** The server renewed its TURN secret; fresh credentials keep media flowing past the old TTL. */
  async renew(onRenewed: (servers: readonly RTCIceServer[]) => void): Promise<void> {
    const servers = await this.fetch();
    runInAction(() => {
      this.isStale = isNil(servers);
      if (!isNil(servers)) {
        this.current = servers;
        onRenewed(servers);
      }
    });
  }
}
