import { Check, Copy, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { useCopyToClipboard } from '../../../../shared/hooks/useCopyToClipboard';
import type { SunStore } from '../../application/SunStore';
import { formatCount, reportText } from '../report-text';
import { sunT } from '../translations';
import { GpuDetails } from './GpuDetails';
import { PanelRow } from './PanelRow';

const { panel: t } = sunT;
const ICON_SIZE_PX = 14;
const UNKNOWN = '—';
const BUTTON_CLASS =
  'flex size-6 items-center justify-center rounded text-neutral-300 hover:bg-neutral-100/10 hover:text-neutral-50';

/**
 * The test's results over the canvas, laid out to be read off a screenshot:
 * the frame rate against the display's, the triangles it holds, and the card.
 */
export const BenchmarkPanel = observer(({ store }: { readonly store: SunStore }) => {
  const { status, copy } = useCopyToClipboard();
  const handleCopy = useEventCallback(() => {
    void copy(
      reportText({
        benchmark: store.benchmark,
        fps: store.fps,
        viewport: store.viewport,
        gpu: store.gpu,
        webgl: store.webgl,
        userAgent: navigator.userAgent,
      })
    );
  });
  const copyLabel = { idle: t.copy, copied: t.copied, failed: t.copyFailed }[status];
  const { phase, refreshRate, viewport } = store;

  return (
    <aside className="absolute top-3 right-3 flex max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto rounded-lg bg-neutral-900/70 p-3 font-mono text-[11px] leading-snug text-neutral-200 shadow-lg backdrop-blur">
      <section>
        <header className="mb-1 flex items-center gap-1">
          <h2 className="mr-auto text-xs font-semibold tracking-wider uppercase">{t.title}</h2>
          <button
            type="button"
            onClick={store.restart}
            aria-label={t.restart}
            title={t.restart}
            className={BUTTON_CLASS}
          >
            <RotateCcw size={ICON_SIZE_PX} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copyLabel}
            title={copyLabel}
            className={BUTTON_CLASS}
          >
            {status === 'copied' ? (
              <Check size={ICON_SIZE_PX} aria-hidden="true" />
            ) : (
              <Copy size={ICON_SIZE_PX} aria-hidden="true" />
            )}
          </button>
        </header>
        <p className="mb-1 text-neutral-400" aria-live="polite">
          {t.status[phase]}
        </p>
        <dl>
          <PanelRow label={t.fps} value={phase === 'calibrating' ? UNKNOWN : String(store.fps)} />
          <PanelRow
            label={t.display}
            value={refreshRate === undefined ? UNKNOWN : t.hertz(refreshRate)}
          />
          {phase === 'searching' && (
            <PanelRow label={t.trying} value={formatCount(store.triangles)} />
          )}
          <PanelRow
            label={t.holds}
            value={
              phase === 'calibrating'
                ? UNKNOWN
                : `${store.isCapped ? '≥ ' : ''}${formatCount(store.holds)}`
            }
          />
          <PanelRow
            label={t.canvas}
            value={
              viewport === undefined
                ? UNKNOWN
                : `${viewport.width}×${viewport.height} @${viewport.devicePixelRatio}x`
            }
          />
        </dl>
      </section>
      <GpuDetails store={store} />
    </aside>
  );
});
