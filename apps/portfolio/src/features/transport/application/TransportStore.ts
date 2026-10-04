import { makeAutoObservable } from 'mobx';

import type { IClock } from '../domain/ports/clock';
import type { IFileEcho } from '../domain/ports/file-echo';
import type { FileSinkOpener } from '../domain/ports/file-sink-opener';
import type { IPlotClient } from '../domain/ports/plot-client';
import type { ITransportLink } from '../domain/ports/transport-link';
import { ConnectionModel } from './ConnectionModel';
import { EchoModel } from './EchoModel';
import { PlotModel } from './PlotModel';

export interface TransportStoreDependencies {
  readonly link: ITransportLink;
  readonly plotClient: IPlotClient;
  readonly fileEcho: IFileEcho;
  readonly openSink: FileSinkOpener;
  readonly clock: IClock;
  readonly devicePixelRatio: () => number;
}

/** The page's three concerns over one transport: which protocol carries it, the plot, the echo. */
export class TransportStore {
  readonly connection: ConnectionModel;
  readonly plot: PlotModel;
  readonly echo: EchoModel;
  private readonly link: ITransportLink;
  private readonly lifetime = new AbortController();

  constructor({
    link,
    plotClient,
    fileEcho,
    openSink,
    clock,
    devicePixelRatio,
  }: TransportStoreDependencies) {
    this.link = link;
    this.connection = new ConnectionModel(link);
    this.plot = new PlotModel({ client: plotClient, clock, devicePixelRatio });
    this.echo = new EchoModel({
      fileEcho,
      openSink,
      clock,
      currentProtocol: () => this.connection.protocol,
    });
    makeAutoObservable<TransportStore, 'link' | 'lifetime'>(
      this,
      { connection: false, plot: false, echo: false, link: false, lifetime: false },
      { autoBind: true }
    );
  }

  /** Asks the server for its limits; the first call also opens the session. */
  async init(): Promise<void> {
    const signal = this.lifetime.signal;
    await Promise.allSettled([this.plot.loadLimits(signal), this.echo.loadLimits(signal)]);
  }

  dispose(): void {
    this.lifetime.abort();
    this.plot.dispose();
    this.echo.dispose();
    this.connection.dispose();
    this.link.dispose();
  }
}
