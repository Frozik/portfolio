import type { ISO } from '@frozik/utils/date/types';
import { describe, expect, it } from 'vitest';

import { createBugReport, FIXTURE_TIME } from '../testing/report-fixture';
import { archiveFileName, layoutArchive } from './archive-layout';

const PNG = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const WEBM = new Blob([new Uint8Array(10)], { type: 'video/webm' });

describe('archive layout', () => {
  it('names the archive after its creation time without characters file systems reject', () => {
    expect(archiveFileName(FIXTURE_TIME)).toBe('bug-report-2026-10-04T12-30-00.zip');
  });

  it('puts the summary first, then the manifest, console and attachments', () => {
    const report = createBugReport({
      attachments: [
        { kind: 'screenshot', id: 's1', image: PNG },
        {
          kind: 'recording',
          id: 'r1',
          video: WEBM,
          format: { mimeType: 'video/webm', extension: 'webm' },
          durationMs: 1200,
        },
        { kind: 'screenshot', id: 's2', image: PNG },
      ],
    });

    expect(layoutArchive(report).map(entry => entry.name)).toEqual([
      'report.md',
      'report.json',
      'console.txt',
      'screenshots/1.png',
      'recording.webm',
      'screenshots/2.png',
    ]);
  });

  it('leaves an excluded section out of the archive entirely', () => {
    const report = createBugReport({
      included: {
        console: false,
        errors: true,
        breadcrumbs: false,
        network: true,
        performance: false,
        environment: false,
      },
      diagnostics: {
        ...createBugReport().diagnostics,
        console: [{ timestamp: FIXTURE_TIME, level: 'log', message: 'secret', count: 1 }],
      },
    });
    const entries = layoutArchive(report);
    const manifest = JSON.parse(String(entries.find(entry => entry.name === 'report.json')?.data));

    expect(entries.some(entry => entry.name === 'console.txt')).toBe(false);
    expect(Object.keys(manifest)).not.toContain('breadcrumbs');
    expect(Object.keys(manifest)).not.toContain('environment');
    expect(manifest.page.url).toBe('https://example.test/portfolio/bug-reporter');
    expect(JSON.stringify(entries)).not.toContain('secret');
  });

  it('writes the comment and the recent errors into the markdown summary', () => {
    const report = createBugReport({
      comment: 'Transfer button does nothing',
      diagnostics: {
        ...createBugReport().diagnostics,
        errors: [
          {
            timestamp: '2026-10-04T12:29:00.000Z' as ISO,
            kind: 'uncaught',
            message: 'TypeError: x is undefined',
            stack: null,
            source: 'app.js:10',
            count: 2,
          },
        ],
      },
    });
    const summary = String(layoutArchive(report)[0]?.data);

    expect(summary).toContain('Transfer button does nothing');
    expect(summary).toContain('`uncaught` TypeError: x is undefined — app.js:10 (×2)');
    expect(summary).toContain('- console: 0 lines');
  });
});
