import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { useTanksStore } from '../../application/useTanksStore';
import { tanksT } from '../translations';

/** The compact stand-in for the original's per-type tally screen (v1 scope). */
export const StageClearOverlay = observer(() => {
  const store = useTanksStore();
  const { stageSummary } = store;

  if (isNil(stageSummary)) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
      <div className="flex animate-fade-in flex-col items-center gap-3 rounded-lg border border-border bg-surface-elevated px-8 py-6 text-center">
        <h2 className="font-mono text-lg font-semibold uppercase tracking-[0.2em] text-text">
          {tanksT.stageClear(stageSummary.stageNumber)}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-text-muted">{tanksT.enemiesDestroyed}</dt>
          <dd className="text-right font-mono tabular-nums text-text">
            {stageSummary.enemiesDestroyed}
          </dd>
          <dt className="text-text-muted">{tanksT.stagePoints}</dt>
          <dd className="text-right font-mono tabular-nums text-text">{stageSummary.points}</dd>
        </dl>
      </div>
    </div>
  );
});
