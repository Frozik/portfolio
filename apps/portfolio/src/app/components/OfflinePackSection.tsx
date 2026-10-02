import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, CloudDownload, WifiOff } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';

import type { OfflinePackStore } from '../offline/OfflinePackStore';
import { appT } from '../translations';
import { PROJECT_ICON_SIZE_PX } from './navTypes';

const PERCENT = 100;

const ACTION_BUTTON_CLASS =
  'rounded-sm border border-landing-border px-3 py-1 font-mono text-xs text-landing-fg-dim transition-colors hover:border-landing-accent hover:text-landing-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent';

const StatusLine = ({
  icon: Icon,
  iconClassName,
  children,
}: {
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly children: ReactNode;
}) => (
  <div className="flex items-center gap-3 px-3 text-sm text-landing-fg-dim">
    <Icon size={PROJECT_ICON_SIZE_PX} className={iconClassName} aria-hidden="true" />
    <span className="min-w-0 flex-1">{children}</span>
  </div>
);

export const OfflinePackSection = observer(({ store }: { readonly store: OfflinePackStore }) => {
  useEffect(() => store.refresh(), [store]);
  const progressLabelId = useId();
  const { status } = store;
  if (isNil(status)) {
    return null;
  }
  const t = appT.offline;

  const renderStatus = (): ReactNode => {
    switch (status.state) {
      case 'ready':
        return (
          <StatusLine icon={CheckCircle2} iconClassName="shrink-0 text-landing-accent">
            {t.ready}
          </StatusLine>
        );
      case 'downloading': {
        const percent = status.total === 0 ? PERCENT : (status.cached / status.total) * PERCENT;
        return (
          <StatusLine
            icon={CloudDownload}
            iconClassName="shrink-0 animate-pulse text-landing-fg-faint"
          >
            <span id={progressLabelId} className="block">
              {t.downloading(status.cached, status.total)}
            </span>
            <span
              role="progressbar"
              aria-labelledby={progressLabelId}
              aria-valuemin={0}
              aria-valuemax={PERCENT}
              aria-valuenow={Math.round(percent)}
              className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-landing-border"
            >
              <span
                className="block h-full bg-landing-accent transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </span>
          </StatusLine>
        );
      }
      case 'incomplete':
        return (
          <StatusLine icon={WifiOff} iconClassName="shrink-0 text-landing-fg-faint">
            <span className="flex items-center justify-between gap-3">
              {t.incomplete}
              <button type="button" onClick={store.download} className={ACTION_BUTTON_CLASS}>
                {t.download}
              </button>
            </span>
          </StatusLine>
        );
      case 'failed':
        return (
          <StatusLine icon={AlertTriangle} iconClassName="shrink-0 text-landing-fg-faint">
            <span className="flex items-center justify-between gap-3">
              {t.failed}
              <button type="button" onClick={store.download} className={ACTION_BUTTON_CLASS}>
                {t.retry}
              </button>
            </span>
          </StatusLine>
        );
      default:
        return assertNever(status);
    }
  };

  return (
    <section className="relative z-10 flex flex-col gap-2">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-landing-fg-faint uppercase">
        {t.heading}
      </h3>
      {renderStatus()}
      {!store.automatic && status.state !== 'ready' && (
        <p className="px-3 text-xs text-landing-fg-faint">{t.installHint}</p>
      )}
    </section>
  );
});
