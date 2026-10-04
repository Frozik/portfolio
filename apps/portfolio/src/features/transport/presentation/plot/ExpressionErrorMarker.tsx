import { memo } from 'react';

import type { ExpressionErrorReason } from '../../domain/plot';
import { transportT } from '../translations';

/** The expression with a caret under the character the server stopped at. */
const ExpressionErrorMarkerComponent = ({
  expression,
  position,
  reason,
}: {
  readonly expression: string;
  readonly position: number;
  readonly reason: ExpressionErrorReason;
}) => (
  <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error/10 p-3 text-error">
    <pre className="overflow-x-auto font-mono text-sm leading-tight">
      {expression}
      {'\n'}
      {`${' '.repeat(position)}^`}
    </pre>
    <span className="text-xs">{transportT.plot.expressionErrors[reason]}</span>
  </div>
);

export const ExpressionErrorMarker = memo(ExpressionErrorMarkerComponent);
