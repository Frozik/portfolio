import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import { useTanksStore } from '../../application/useTanksStore';
import {
  STAGE_CURTAIN_BOTTOM_CLOSE_CLASS,
  STAGE_CURTAIN_BOTTOM_OPEN_CLASS,
  STAGE_CURTAIN_TOP_CLOSE_CLASS,
  STAGE_CURTAIN_TOP_OPEN_CLASS,
} from '../constants';
import { tanksT } from '../translations';

const CURTAIN_HALF_CLASS = 'absolute inset-x-0 h-1/2 overflow-hidden bg-neutral-600';
const CURTAIN_LABEL_CLASS =
  'absolute inset-x-0 font-mono text-3xl font-semibold uppercase tracking-[0.3em] ' +
  'text-neutral-900';

/** A button so tap, click and keyboard all skip through the same path; inert while opening. */
export const StageIntro = observer(({ isOpening }: { readonly isOpening: boolean }) => {
  const store = useTanksStore();
  const { stageNumber } = store;

  const handleSkip = useFunction(() => {
    store.skipStageIntro();
  });

  return (
    <button
      type="button"
      aria-label={tanksT.skipIntro}
      aria-hidden={isOpening}
      disabled={isOpening}
      onClick={handleSkip}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <span
        className={cn(
          CURTAIN_HALF_CLASS,
          'top-0',
          isOpening ? STAGE_CURTAIN_TOP_OPEN_CLASS : STAGE_CURTAIN_TOP_CLOSE_CLASS
        )}
      >
        <span className={cn(CURTAIN_LABEL_CLASS, 'bottom-0 translate-y-1/2')} aria-hidden="true">
          {tanksT.stage(stageNumber)}
        </span>
      </span>
      <span
        className={cn(
          CURTAIN_HALF_CLASS,
          'bottom-0',
          isOpening ? STAGE_CURTAIN_BOTTOM_OPEN_CLASS : STAGE_CURTAIN_BOTTOM_CLOSE_CLASS
        )}
      >
        <span className={cn(CURTAIN_LABEL_CLASS, 'top-0 -translate-y-1/2')} aria-hidden="true">
          {tanksT.stage(stageNumber)}
        </span>
      </span>
    </button>
  );
});
