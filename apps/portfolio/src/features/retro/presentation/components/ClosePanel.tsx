import { useFunction } from '@frozik/components/hooks/useFunction';
import { Eye } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { RoomStore } from '../../application/RoomStore';
import { ERetroPhase } from '../../domain/types';
import { retroT as t } from '../translations';

const ICON_SIZE_PX = 12;

interface ClosePanelProps {
  readonly store: RoomStore;
}

export const ClosePanel = observer(({ store }: ClosePanelProps) => {
  const handleOpenResults = useFunction(() => store.openExportDialog());

  if (store.phase !== ERetroPhase.Close) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <MonoKicker tone="accent">{t.close.exportKicker}</MonoKicker>
        <span className="section-rule" />
      </div>
      <CardFrame className="flex flex-col items-start gap-3 px-5 py-5">
        <h2 className="m-0 text-[15px] font-medium text-landing-fg">{t.close.title}</h2>
        <p className="m-0 text-[13px] leading-[1.55] text-landing-fg-dim">
          {t.close.summarySubtitle}
        </p>
        <button
          type="button"
          onClick={handleOpenResults}
          className="inline-flex items-center gap-1.5 border border-landing-accent-dim px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-landing-accent transition-colors hover:border-landing-accent hover:bg-landing-accent/10"
        >
          <Eye size={ICON_SIZE_PX} />
          {t.close.viewResults}
        </button>
      </CardFrame>
    </section>
  );
});
