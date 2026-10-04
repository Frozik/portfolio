import type { ISO } from '@frozik/utils/date/types';

import type { IBugReport, IConsoleEntry, TAttachment } from './report';
import { formatSummary } from './report-summary';

export const MANIFEST_FILE = 'report.json';
export const SUMMARY_FILE = 'report.md';
export const CONSOLE_FILE = 'console.txt';
const SCREENSHOT_DIR = 'screenshots';
const RECORDING_FILE = 'recording';
const MANIFEST_INDENT = 2;

export function archiveFileName(createdAt: ISO): string {
  const stamp = createdAt.replace(/\.\d+Z$/, '').replaceAll(':', '-');
  return `bug-report-${stamp}.zip`;
}

export interface IArchiveEntry {
  readonly name: string;
  readonly data: string | Blob;
}

/** Everything the archive holds, in order; sections the user excluded never leave the browser. */
export function layoutArchive(report: IBugReport): readonly IArchiveEntry[] {
  const attachments = report.attachments.map((attachment, index) => ({
    name: attachmentFileName(attachment, screenshotIndexOf(report.attachments, index)),
    data: attachment.kind === 'screenshot' ? attachment.image : attachment.video,
  }));
  const consoleText = report.included.console
    ? [{ name: CONSOLE_FILE, data: formatConsole(report.diagnostics.console) }]
    : [];
  return [
    {
      name: SUMMARY_FILE,
      data: formatSummary(
        report,
        attachments.map(entry => entry.name)
      ),
    },
    {
      name: MANIFEST_FILE,
      data: JSON.stringify(buildManifest(report, attachments), null, MANIFEST_INDENT),
    },
    ...consoleText,
    ...attachments,
  ];
}

function attachmentFileName(attachment: TAttachment, screenshotIndex: number): string {
  switch (attachment.kind) {
    case 'screenshot':
      return `${SCREENSHOT_DIR}/${screenshotIndex + 1}.png`;
    case 'recording':
      return `${RECORDING_FILE}.${attachment.format.extension}`;
    default:
      return attachment satisfies never;
  }
}

function screenshotIndexOf(attachments: readonly TAttachment[], index: number): number {
  return attachments.slice(0, index).filter(attachment => attachment.kind === 'screenshot').length;
}

function buildManifest(
  report: IBugReport,
  attachments: readonly IArchiveEntry[]
): Record<string, unknown> {
  const { diagnostics, included } = report;
  const { capturedAt, url, pageTitle } = diagnostics.environment;
  return {
    schemaVersion: report.schemaVersion,
    createdAt: report.createdAt,
    page: { url, title: pageTitle, capturedAt },
    comment: report.comment,
    included,
    attachments: attachments.map((entry, index) => ({
      file: entry.name,
      ...describeAttachment(report.attachments[index]),
    })),
    ...(included.errors ? { errors: diagnostics.errors } : {}),
    ...(included.breadcrumbs ? { breadcrumbs: diagnostics.breadcrumbs } : {}),
    ...(included.network ? { network: diagnostics.network } : {}),
    ...(included.performance ? { performance: diagnostics.performance } : {}),
    ...(included.environment ? { environment: diagnostics.environment } : {}),
  };
}

function describeAttachment(attachment: TAttachment | undefined): Record<string, unknown> {
  if (attachment === undefined) {
    return {};
  }
  switch (attachment.kind) {
    case 'screenshot':
      return { kind: 'screenshot', bytes: attachment.image.size };
    case 'recording':
      return {
        kind: 'recording',
        bytes: attachment.video.size,
        mimeType: attachment.format.mimeType,
        durationMs: attachment.durationMs,
      };
    default:
      return attachment satisfies never;
  }
}

export function formatConsole(entries: readonly IConsoleEntry[]): string {
  return entries
    .map(entry => {
      const repeat = entry.count > 1 ? ` (×${entry.count})` : '';
      return `${entry.timestamp} [${entry.level}] ${entry.message}${repeat}`;
    })
    .join('\n');
}
