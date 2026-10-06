import type { ConnectRouter } from '@connectrpc/connect';
import { createConnectRouter } from '@connectrpc/connect';
import { FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';
import type { CallRecord } from '@frozik/transport/server/call-recorder';
import { createCallRecorder } from '@frozik/transport/server/call-recorder';

import type { PlotLimits } from '../../application/transport/samplePlot';
import type { FileServiceDependencies } from './file-service';
import { createFileService } from './file-service';
import { createPlotService } from './plot-service';

/** Room for a message envelope and protobuf framing around the largest chunk. */
const MESSAGE_OVERHEAD_BYTES = 1024;

export function createTransportRouter(
  plotLimits: PlotLimits,
  file: FileServiceDependencies,
  onCall: (record: CallRecord) => void
): ConnectRouter {
  return createConnectRouter({
    connect: true,
    grpc: false,
    grpcWeb: false,
    readMaxBytes: file.limits.maxChunkBytes + MESSAGE_OVERHEAD_BYTES,
    interceptors: [createCallRecorder(onCall)],
  })
    .service(PlotService, createPlotService(plotLimits))
    .service(FileService, createFileService(file));
}
