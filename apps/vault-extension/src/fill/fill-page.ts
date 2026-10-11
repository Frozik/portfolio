import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { detectLoginForm } from '../domain/autofill/detect-login-form';
import type { IFrameFacts } from '../domain/frame-verdict';
import { frameVerdict } from '../domain/frame-verdict';
import type { TFillOutcome } from '../domain/messages';
import type { IFillRequest } from '../domain/ports';
import type { TIsRendered, TOpenShadow } from './collect-fields';
import { collectFields } from './collect-fields';
import { typeInto, typeSplit } from './fill-fields';

/** What a frame says it is: its own location, never what the worker was told. */
export interface IFrame extends IFrameFacts {
  readonly document: Document;
}

function fillOtp(boxes: readonly HTMLInputElement[], code: string | null): TFillOutcome {
  const [single] = boxes;
  if (isNil(code) || isNil(single)) {
    return 'no-form';
  }
  if (boxes.length === 1) {
    typeInto(single, code);
    return 'filled';
  }
  return typeSplit(boxes, code) ? 'filled' : 'no-form';
}

/**
 * One frame fills itself, after checking again that it
 * is the card's site: a navigation between the click and now, or a frame of
 * another origin, gets nothing. Plain HTTP only when the user allowed it;
 * an HTTP frame inside an HTTPS page never.
 */
export function fillPage(
  frame: IFrame,
  request: IFillRequest,
  openShadow: TOpenShadow,
  isRendered: TIsRendered = () => true
): TFillOutcome {
  const verdict = frameVerdict(request, frame);
  if (verdict !== 'fill') {
    return verdict;
  }
  const { records, inputs } = collectFields(frame.document, openShadow, isRendered);
  const form = detectLoginForm(records);
  switch (form.kind) {
    case 'login': {
      const username = isNil(form.username) ? undefined : inputs[form.username];
      const password = inputs[form.password];
      if (isNil(password) || isNil(request.password)) {
        return 'no-form';
      }
      if (!isNil(username) && !isNil(request.username)) {
        typeInto(username, request.username);
      }
      typeInto(password, request.password);
      return 'filled';
    }
    case 'username': {
      const username = inputs[form.username];
      if (isNil(username) || isNil(request.username)) {
        return 'no-form';
      }
      typeInto(username, request.username);
      return 'filled';
    }
    case 'otp':
      return fillOtp(
        form.fields.flatMap(index => inputs[index] ?? []),
        request.otp
      );
    case 'sign-up':
    case 'none':
      return 'no-form';
    default:
      return assertNever(form);
  }
}
