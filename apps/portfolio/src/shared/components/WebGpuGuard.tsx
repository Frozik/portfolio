import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { sharedT } from '../translations';

const { webGpuGuard: t } = sharedT;

export const WebGpuGuard = memo(
  ({ children, className }: { children: ReactNode; className?: string }) => {
    if (isNil(navigator.gpu)) {
      return (
        <div
          className={`flex flex-col items-center justify-center gap-6 text-center px-6 ${className ?? ''}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-16 w-16 text-text-muted"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <div>
            <h2 className="text-lg font-semibold text-text">{t.title}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
              {t.description}
            </p>
          </div>

          <div className="max-w-md space-y-4 text-left">
            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">{t.safariIOSTitle}</h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-text-secondary">
                {t.safariIOSSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">{t.safariMacOSTitle}</h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-text-secondary">
                {t.safariMacOSSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-text-muted">{t.safariMacOSNote}</p>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">{t.otherBrowsersTitle}</h3>
              <p className="mt-1 text-sm text-text-secondary">{t.otherBrowsersDescription}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <a
              href="https://caniuse.com/webgpu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 underline hover:text-brand-300"
            >
              {t.linkSupport}
            </a>
            <a
              href="https://webkit.org/blog/14879/webgpu-now-available-for-testing-in-safari-technology-preview/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 underline hover:text-brand-300"
            >
              {t.linkWebKit}
            </a>
          </div>
        </div>
      );
    }

    return children;
  }
);
