import { CALL_SCREENING } from '../../../modules/call-screening/src/CallScreeningModule';
import type { CallsFilterApp } from '../../contexts/shell/application/CallsFilterApp';
import type { IDocumentStore } from '../stored-document';
import { runE2eCommand } from './e2e-commands';

/**
 * Lets the e2e tests drive the app over `adb`: each command arrives from the native channel and
 * its answer goes back as JSON. Opens nothing outside the e2e build — the native side refuses.
 */
export function openE2eControl(app: CallsFilterApp, documents: IDocumentStore): void {
  if (!CALL_SCREENING.openE2eControl()) {
    return;
  }
  CALL_SCREENING.addListener('onE2eCommand', ({ id, payload }) => {
    const answer = (json: unknown) => CALL_SCREENING.answerE2eCommand(id, JSON.stringify(json));
    Promise.resolve()
      .then(() => runE2eCommand(app, documents, JSON.parse(payload)))
      .then(
        result => answer({ ok: true, result }),
        (error: unknown) => answer({ ok: false, error: String(error) })
      );
  });
}
