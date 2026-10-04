import type { ExpressionError, ExpressionLimits } from '../../domain/expression/expression-error';
import { parseExpression } from '../../domain/expression/parse';
import type { SampledCurve, SampleRange, SampleRangeError } from '../../domain/expression/sample';
import { sampleCurve, validateSampleRange } from '../../domain/expression/sample';
import type { Result } from '../../domain/Result';
import { err, ok } from '../../domain/Result';

export interface PlotLimits extends ExpressionLimits {
  readonly maxPoints: number;
  readonly chunkPoints: number;
}

export interface PlotRequest extends SampleRange {
  readonly expression: string;
}

export type PlotFailure =
  | { readonly kind: 'expression'; readonly error: ExpressionError }
  | { readonly kind: 'range'; readonly error: SampleRangeError };

/** Parses and samples the curve, cut into chunks the transport streams one by one. */
export function samplePlot(
  request: PlotRequest,
  limits: PlotLimits
): Result<readonly SampledCurve[], PlotFailure> {
  const range = validateSampleRange(request, limits.maxPoints);
  if (!range.ok) {
    return err({ kind: 'range', error: range.error });
  }
  const expression = parseExpression(request.expression, limits);
  if (!expression.ok) {
    return err({ kind: 'expression', error: expression.error });
  }
  const curve = sampleCurve(expression.value, range.value);
  const chunks: SampledCurve[] = [];
  for (let start = 0; start < curve.x.length; start += limits.chunkPoints) {
    const end = start + limits.chunkPoints;
    chunks.push({ x: curve.x.subarray(start, end), y: curve.y.subarray(start, end) });
  }
  return ok(chunks);
}
