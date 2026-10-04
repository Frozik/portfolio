import { assertNever } from '@frozik/utils/assert/assertNever';
import { memo } from 'react';

import { Alert } from '../../../../shared/ui/Alert';
import type { CallFailure } from '../../domain/call-failure';
import { transportT } from '../translations';

const CallFailureNoticeComponent = ({ failure }: { readonly failure: CallFailure }) => {
  switch (failure.kind) {
    case 'expression':
      return <Alert type="error" message={transportT.plot.expressionErrors[failure.reason]} />;
    case 'refused':
      return <Alert type="error" message={transportT.failures.refused(failure.message)} />;
    case 'quota':
      return <Alert type="warning" message={transportT.failures.quota(failure.message)} />;
    case 'unreachable':
      return <Alert type="error" message={transportT.failures.unreachable(failure.message)} />;
    default:
      return assertNever(failure);
  }
};

export const CallFailureNotice = memo(CallFailureNoticeComponent);
