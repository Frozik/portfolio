import { reaction } from 'mobx';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { IClock } from '../../policy/domain/ports/clock';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { compileRuleset } from '../domain/compile-ruleset';
import type { IWhereToChoice } from '../domain/compiled-ruleset';
import type { IScreeningRuntime } from '../domain/ports/screening-runtime';
import type { IScreeningInputs } from '../domain/screening-inputs';

interface IPublishedFacts {
  readonly book: GroupBook;
  readonly environment: IMatchingEnvironment;
  readonly inputs: IScreeningInputs;
  readonly whereTo: readonly IWhereToChoice[];
  readonly repeatPass: TRepeatPass;
}

/**
 * The edge where the book leaves the app: whenever it, the region or the calendars change,
 * the ruleset is compiled again and handed to the service. Returns the stop.
 */
export function publishRulesets(
  facts: () => IPublishedFacts,
  runtime: IScreeningRuntime,
  clock: IClock,
  diagnostics: IDiagnosticsLog
): () => void {
  return reaction(
    facts,
    ({ book, ...context }) => {
      const from = clock.now();
      const ruleset = compileRuleset(book, { ...context, compiledAt: from });
      runtime.publish(ruleset);
      diagnostics.log('info', 'ruleset', 'published', {
        groups: String(ruleset.groups.length),
        ms: String(clock.now().epochMilliseconds - from.epochMilliseconds),
      });
    },
    { fireImmediately: true }
  );
}
