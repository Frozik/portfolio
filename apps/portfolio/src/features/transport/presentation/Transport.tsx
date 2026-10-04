import '@frozik/table/theme/table.css';

import { createTransport } from '@frozik/transport/client/create-transport';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { TransportStore } from '../application/TransportStore';
import { useTransportStore } from '../application/useTransportStore';
import { createConnectPlotClient } from '../infrastructure/connect-plot-client';
import { createFileEcho } from '../infrastructure/file-echo';
import { createFileSinkOpener } from '../infrastructure/file-sink-opener';
import { ConnectionPanel } from './connection/ConnectionPanel';
import { EchoPanel } from './echo/EchoPanel';
import { PlotPanel } from './plot/PlotPanel';
import { TransportIntro } from './TransportIntro';

const COMMUNICATION_URL = import.meta.env.VITE_COMMUNICATION_URL ?? 'http://localhost:4445';
const STREAM_SAVER_MITM = `${import.meta.env.BASE_URL}stream-saver/mitm.html`;

/** The composition root: one transport for every service, built here and nowhere else. */
function createStore(): TransportStore {
  const transport = createTransport({ serverUrl: COMMUNICATION_URL });
  return new TransportStore({
    link: transport,
    plotClient: createConnectPlotClient(transport),
    fileEcho: createFileEcho(transport),
    openSink: createFileSinkOpener(STREAM_SAVER_MITM),
    clock: {
      now: () => performance.now(),
      every: (ms, callback) => {
        const timer = setInterval(callback, ms);
        return () => clearInterval(timer);
      },
    },
    devicePixelRatio: () => window.devicePixelRatio,
  });
}

export const Transport = observer(() => {
  const store = useTransportStore(createStore);

  useEffect(() => {
    void store.init();
  }, [store]);

  return (
    <div className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-10 px-6 pt-12 pb-24 sm:px-8">
      <TransportIntro />
      <ConnectionPanel connection={store.connection} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlotPanel plot={store.plot} />
        <EchoPanel echo={store.echo} />
      </div>
    </div>
  );
});
