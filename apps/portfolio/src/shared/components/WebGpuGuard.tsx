import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';

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
            <h2 className="text-lg font-semibold text-text">WebGPU is not available</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
              This feature requires WebGPU, a modern GPU API for the web. Your browser either does
              not support it or has it disabled.
            </p>
          </div>

          <div className="max-w-md space-y-4 text-left">
            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">Safari on iOS (17.4 – 18.x)</h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-text-secondary">
                <li>
                  Open <strong className="text-text">Settings</strong> app
                </li>
                <li>
                  Scroll to <strong className="text-text">Safari</strong>
                </li>
                <li>
                  Tap <strong className="text-text">Advanced</strong> (at the bottom)
                </li>
                <li>
                  Tap <strong className="text-text">Feature Flags</strong>
                </li>
                <li>
                  Find <strong className="text-text">WebGPU</strong> and toggle it{' '}
                  <strong className="text-success">ON</strong>
                </li>
                <li>Reload this page</li>
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">Safari on macOS (17.4 – 18.x)</h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-text-secondary">
                <li>
                  Open <strong className="text-text">Safari → Settings → Feature Flags</strong>
                </li>
                <li>
                  Find <strong className="text-text">WebGPU</strong> and enable it
                </li>
                <li>Reload this page</li>
              </ol>
              <p className="mt-2 text-xs text-text-muted">
                Safari 26+ (macOS Tahoe, fall 2026) will have WebGPU enabled by default.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated/50 p-4">
              <h3 className="text-sm font-semibold text-text">Other browsers</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Chrome 113+, Edge 113+, and Samsung Internet 24+ support WebGPU out of the box.
                Firefox 141+ supports it on Windows and macOS (Apple Silicon).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <a
              href="https://caniuse.com/webgpu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 underline hover:text-brand-300"
            >
              Browser support table
            </a>
            <a
              href="https://webkit.org/blog/14879/webgpu-now-available-for-testing-in-safari-technology-preview/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-400 underline hover:text-brand-300"
            >
              WebKit blog: WebGPU in Safari
            </a>
          </div>
        </div>
      );
    }

    return children;
  }
);
