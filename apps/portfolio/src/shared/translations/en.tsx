import type { ReactNode } from 'react';

interface WebGpuGuardTranslation {
  title: string;
  description: string;
  safariIOSTitle: string;
  safariIOSSteps: readonly ReactNode[];
  safariMacOSTitle: string;
  safariMacOSSteps: readonly ReactNode[];
  safariMacOSNote: string;
  otherBrowsersTitle: string;
  otherBrowsersDescription: string;
  linkSupport: string;
  linkWebKit: string;
}

export interface SharedTranslation {
  webGpuGuard: WebGpuGuardTranslation;
}

export const sharedTranslationsEn: SharedTranslation = {
  webGpuGuard: {
    title: 'WebGPU is not available',
    description:
      'This feature requires WebGPU, a modern GPU API for the web. Your browser either does not support it or has it disabled.',
    safariIOSTitle: 'Safari on iOS (17.4 – 18.x)',
    safariIOSSteps: [
      <>
        Open <strong className="text-text">Settings</strong> app
      </>,
      <>
        Scroll to <strong className="text-text">Safari</strong>
      </>,
      <>
        Tap <strong className="text-text">Advanced</strong> (at the bottom)
      </>,
      <>
        Tap <strong className="text-text">Feature Flags</strong>
      </>,
      <>
        Find <strong className="text-text">WebGPU</strong> and toggle it{' '}
        <strong className="text-success">ON</strong>
      </>,
      'Reload this page',
    ],
    safariMacOSTitle: 'Safari on macOS (17.4 – 18.x)',
    safariMacOSSteps: [
      <>
        Open <strong className="text-text">Safari → Settings → Feature Flags</strong>
      </>,
      <>
        Find <strong className="text-text">WebGPU</strong> and enable it
      </>,
      'Reload this page',
    ],
    safariMacOSNote: 'Safari 26+ (macOS Tahoe, fall 2026) will have WebGPU enabled by default.',
    otherBrowsersTitle: 'Other browsers',
    otherBrowsersDescription:
      'Chrome 113+, Edge 113+, and Samsung Internet 24+ support WebGPU out of the box. Firefox 141+ supports it on Windows and macOS (Apple Silicon).',
    linkSupport: 'Browser support table',
    linkWebKit: 'WebKit blog: WebGPU in Safari',
  },
};
