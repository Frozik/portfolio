import type { ISO } from '@frozik/utils/date/types';

import type { IBreadcrumb } from './breadcrumb';
import type { IRecordingFormat } from './recording-format';

export const REPORT_SCHEMA_VERSION = 1;

export type TConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface IConsoleEntry {
  readonly timestamp: ISO;
  readonly level: TConsoleLevel;
  readonly message: string;
  /** Identical consecutive lines are folded into one entry with a count. */
  readonly count: number;
}

export type TErrorKind = 'uncaught' | 'unhandledrejection' | 'resource' | 'csp' | 'deprecation';

export interface IErrorEntry {
  readonly timestamp: ISO;
  readonly kind: TErrorKind;
  readonly message: string;
  readonly stack: string | null;
  readonly source: string | null;
  readonly count: number;
}

export interface INetworkEntry {
  readonly timestamp: ISO;
  readonly transport: 'fetch' | 'xhr';
  readonly method: string;
  /** Origin and path only — a query string may carry tokens. */
  readonly url: string;
  readonly status: number | null;
  readonly durationMs: number;
  readonly failed: boolean;
}

export type TVitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
export type TVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface IWebVital {
  readonly name: TVitalName;
  readonly value: number;
  readonly rating: TVitalRating;
  readonly attribution: Readonly<Record<string, string | number>>;
}

export interface ILongFrameScript {
  readonly source: string;
  readonly functionName: string;
  readonly invoker: string;
  readonly durationMs: number;
}

export interface ILongFrame {
  readonly timestamp: ISO;
  readonly durationMs: number;
  readonly blockingMs: number;
  readonly scripts: readonly ILongFrameScript[];
}

export interface IResourceEntry {
  readonly name: string;
  readonly initiator: string;
  readonly durationMs: number;
  readonly transferBytes: number;
}

export interface IResourceSummary {
  readonly count: number;
  readonly transferBytes: number;
  readonly slowest: readonly IResourceEntry[];
}

export type TMemoryReading =
  | {
      readonly kind: 'heap';
      readonly usedBytes: number;
      readonly totalBytes: number;
      readonly limitBytes: number;
    }
  | { readonly kind: 'unavailable'; readonly reason: string };

export interface IFpsSummary {
  readonly frames: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  readonly droppedFrames: number;
}

export interface INavigationTiming {
  readonly type: string;
  readonly ttfbMs: number;
  readonly domContentLoadedMs: number;
  readonly loadMs: number;
}

export interface IPerformanceSnapshot {
  readonly vitals: readonly IWebVital[];
  readonly longFrames: readonly ILongFrame[];
  readonly resources: IResourceSummary;
  readonly memory: TMemoryReading;
  readonly fps: IFpsSummary | null;
  readonly navigation: INavigationTiming | null;
  readonly domNodes: number;
}

export interface IBrowserBrand {
  readonly brand: string;
  readonly version: string;
}

export interface IConnectionInfo {
  readonly effectiveType: string;
  readonly rttMs: number;
  readonly downlinkMbps: number;
  readonly saveData: boolean;
}

export interface IGpuInfo {
  readonly vendor: string;
  readonly architecture: string;
  readonly device: string;
  readonly description: string;
  readonly features: readonly string[];
}

export interface IEnvironment {
  readonly capturedAt: ISO;
  readonly url: string;
  readonly referrer: string;
  readonly pageTitle: string;
  readonly userAgent: string;
  readonly brands: readonly IBrowserBrand[];
  readonly platform: string | null;
  readonly language: string;
  readonly languages: readonly string[];
  readonly timeZone: string;
  readonly hardwareConcurrency: number | null;
  readonly deviceMemoryGb: number | null;
  readonly connection: IConnectionInfo | null;
  readonly screen: { readonly width: number; readonly height: number; readonly colorDepth: number };
  readonly viewport: { readonly width: number; readonly height: number; readonly scale: number };
  readonly devicePixelRatio: number;
  readonly colorScheme: 'light' | 'dark';
  readonly reducedMotion: boolean;
  readonly pointer: 'fine' | 'coarse' | 'none';
  readonly online: boolean;
  readonly visibility: string;
  readonly crossOriginIsolated: boolean;
  readonly storage: { readonly usageBytes: number; readonly quotaBytes: number } | null;
  readonly gpu: IGpuInfo | null;
}

export interface IDiagnosticsSnapshot {
  readonly console: readonly IConsoleEntry[];
  readonly errors: readonly IErrorEntry[];
  readonly breadcrumbs: readonly IBreadcrumb[];
  readonly network: readonly INetworkEntry[];
  readonly performance: IPerformanceSnapshot;
  readonly environment: IEnvironment;
}

export type TDiagnosticsSection = keyof IDiagnosticsSnapshot;

export const DIAGNOSTICS_SECTIONS: readonly TDiagnosticsSection[] = [
  'console',
  'errors',
  'breadcrumbs',
  'network',
  'performance',
  'environment',
];

export type TIncludedSections = Readonly<Record<TDiagnosticsSection, boolean>>;

/** How much each history holds right now — performance counts its long frames and vitals; the environment is one snapshot. */
export interface IDiagnosticsCounts {
  readonly console: number;
  readonly errors: number;
  readonly breadcrumbs: number;
  readonly network: number;
  readonly performance: number;
}

export const EMPTY_COUNTS: IDiagnosticsCounts = {
  console: 0,
  errors: 0,
  breadcrumbs: 0,
  network: 0,
  performance: 0,
};

export type TAttachment =
  | { readonly kind: 'screenshot'; readonly id: string; readonly image: Blob }
  | {
      readonly kind: 'recording';
      readonly id: string;
      readonly video: Blob;
      readonly format: IRecordingFormat;
      readonly durationMs: number;
    };

export interface IBugReport {
  readonly schemaVersion: typeof REPORT_SCHEMA_VERSION;
  readonly createdAt: ISO;
  readonly comment: string;
  readonly included: TIncludedSections;
  readonly diagnostics: IDiagnosticsSnapshot;
  readonly attachments: readonly TAttachment[];
}
