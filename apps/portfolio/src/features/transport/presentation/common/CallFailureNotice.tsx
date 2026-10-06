import { assertNever } from '@frozik/utils/assert/assertNever';
import { memo } from 'react';

import { Alert } from '../../../../shared/ui/Alert';
import type { CallFailure } from '../../domain/call-failure';
import { transportT } from '../translations';
import { TraceIdLine } from './TraceIdLine';

const CallFailureNoticeComponent = ({ failure }: { readonly failure: CallFailure }) => {
  const trace =
    failure.traceId === undefined ? undefined : <TraceIdLine traceId={failure.traceId} />;
  switch (failure.kind) {
    case 'expression':
      return (
        <Alert
          type="error"
          message={transportT.plot.expressionErrors[failure.reason]}
          description={trace}
        />
      );
    case 'refused':
      return (
        <Alert
          type="error"
          message={transportT.failures.refused(failure.message)}
          description={trace}
        />
      );
    case 'quota':
      return (
        <Alert
          type="warning"
          message={transportT.failures.quota(failure.message)}
          description={trace}
        />
      );
    case 'unreachable':
      return (
        <Alert
          type="error"
          message={transportT.failures.unreachable(failure.message)}
          description={trace}
        />
      );
    default:
      return assertNever(failure);
  }
};

export const CallFailureNotice = memo(CallFailureNoticeComponent);
