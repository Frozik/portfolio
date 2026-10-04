import type { PlotCurve, PlotLimits, SampleRequest } from '../plot';

export interface IPlotClient {
  limits(signal: AbortSignal): Promise<PlotLimits>;
  /** Rejects with `CallFailedError`. */
  sample(request: SampleRequest, signal: AbortSignal): Promise<PlotCurve>;
}
