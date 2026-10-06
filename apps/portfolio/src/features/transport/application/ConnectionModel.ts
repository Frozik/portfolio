import { makeAutoObservable, observableRef } from 'mobx';

import type {
  ConnectionState,
  TransportMode,
  TransportProtocol,
  WireFormat,
} from '../domain/connection';
import type { ITransportLink } from '../domain/ports/transport-link';

/** Mirrors what the transport reports; the transport alone decides the protocol. */
export class ConnectionModel {
  state: ConnectionState;
  mode: TransportMode = 'auto';
  wireFormat: WireFormat;
  private readonly unsubscribe: () => void;

  constructor(private readonly link: ITransportLink) {
    this.state = link.state;
    this.wireFormat = link.wireFormat;
    makeAutoObservable<ConnectionModel, 'link' | 'unsubscribe'>(
      this,
      { link: false, unsubscribe: false, state: observableRef },
      { autoBind: true }
    );
    this.unsubscribe = link.subscribe(this.applyState);
  }

  get protocol(): TransportProtocol | undefined {
    return this.state.kind === 'open' ? this.state.protocol : undefined;
  }

  setMode(mode: TransportMode): void {
    this.mode = mode;
    this.link.setMode(mode);
  }

  setWireFormat(format: WireFormat): void {
    this.wireFormat = format;
    this.link.setWireFormat(format);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private applyState(state: ConnectionState): void {
    this.state = state;
  }
}
