import type { ISO } from '@frozik/utils/date/types';

import type { IBugReport, IDiagnosticsSnapshot, IEnvironment } from '../core/report';
import { REPORT_SCHEMA_VERSION } from '../core/report';

export const FIXTURE_TIME = '2026-10-04T12:30:00.000Z' as ISO;

export const FIXTURE_ENVIRONMENT: IEnvironment = {
  capturedAt: FIXTURE_TIME,
  url: 'https://example.test/portfolio/bug-reporter',
  referrer: '',
  pageTitle: 'Treasury desk',
  userAgent: 'Mozilla/5.0 (Test)',
  brands: [{ brand: 'Chromium', version: '142' }],
  platform: 'macOS',
  language: 'en-US',
  languages: ['en-US'],
  timeZone: 'UTC',
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  connection: null,
  screen: { width: 1920, height: 1080, colorDepth: 30 },
  viewport: { width: 1440, height: 900, scale: 1 },
  devicePixelRatio: 2,
  colorScheme: 'dark',
  reducedMotion: false,
  pointer: 'fine',
  online: true,
  visibility: 'visible',
  crossOriginIsolated: false,
  storage: null,
  gpu: null,
};

export function createDiagnosticsSnapshot(
  overrides: Partial<IDiagnosticsSnapshot> = {}
): IDiagnosticsSnapshot {
  return {
    console: [],
    errors: [],
    breadcrumbs: [],
    network: [],
    performance: {
      vitals: [],
      longFrames: [],
      resources: { count: 0, transferBytes: 0, slowest: [] },
      memory: { kind: 'unavailable', reason: 'test' },
      fps: null,
      navigation: null,
      domNodes: 0,
    },
    environment: FIXTURE_ENVIRONMENT,
    ...overrides,
  };
}

export function createBugReport(overrides: Partial<IBugReport> = {}): IBugReport {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: FIXTURE_TIME,
    comment: '',
    included: {
      console: true,
      errors: true,
      breadcrumbs: true,
      network: true,
      performance: true,
      environment: true,
    },
    diagnostics: createDiagnosticsSnapshot(),
    attachments: [],
    ...overrides,
  };
}
