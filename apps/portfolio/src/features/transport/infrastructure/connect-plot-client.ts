import type { Transport } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';

import { joinChunks } from '../domain/plot';
import type { IPlotClient } from '../domain/ports/plot-client';
import { toCallFailedError } from './call-failure-mapping';

export function createConnectPlotClient(transport: Transport): IPlotClient {
  const client = createClient(PlotService, transport);
  return {
    async limits(signal) {
      try {
        const limits = await client.getPlotLimits({}, { signal });
        return {
          expressionMaxLength: limits.expressionMaxLength,
          sampleMaxPoints: limits.sampleMaxPoints,
        };
      } catch (error) {
        throw toCallFailedError(error);
      }
    },
    async sample(request, signal) {
      try {
        return joinChunks(await Array.fromAsync(client.sample(request, { signal })));
      } catch (error) {
        throw toCallFailedError(error);
      }
    },
  };
}
