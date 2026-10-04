import type { IBugReport, IErrorEntry, TDiagnosticsSection } from './report';
import { DIAGNOSTICS_SECTIONS } from './report';

const SUMMARY_ERRORS = 10;
const VITAL_DECIMALS = 2;

/** The human-readable `report.md`: what a reporter pastes into an issue before attaching the archive. */
export function formatSummary(report: IBugReport, attachmentFiles: readonly string[]): string {
  const { environment, errors } = report.diagnostics;
  const comment = report.comment.trim() === '' ? '_No comment._' : report.comment.trim();
  const errorLines = report.included.errors
    ? errors.slice(-SUMMARY_ERRORS).map(formatErrorLine)
    : [];
  const browser =
    report.included.environment && environment.userAgent !== ''
      ? environment.userAgent
      : '_excluded_';
  const title = environment.pageTitle === '' ? '' : ` — ${environment.pageTitle}`;
  return [
    '# Bug report',
    '',
    `- **Page:** ${environment.url}${title}`,
    `- **Created:** ${report.createdAt}`,
    `- **Browser:** ${browser}`,
    '',
    '## What happened',
    '',
    comment,
    '',
    '## Attachments',
    '',
    ...(attachmentFiles.length === 0 ? ['_None._'] : attachmentFiles.map(file => `- \`${file}\``)),
    '',
    '## Errors',
    '',
    ...(errorLines.length === 0 ? ['_None recorded._'] : errorLines),
    '',
    '## Included diagnostics',
    '',
    ...DIAGNOSTICS_SECTIONS.map(section => formatSectionLine(section, report)),
    '',
  ].join('\n');
}

function formatErrorLine(error: IErrorEntry): string {
  const repeat = error.count > 1 ? ` (×${error.count})` : '';
  const source = error.source === null ? '' : ` — ${error.source}`;
  return `- \`${error.kind}\` ${error.message}${source}${repeat}`;
}

function formatSectionLine(section: TDiagnosticsSection, report: IBugReport): string {
  if (!report.included[section]) {
    return `- ${section}: excluded`;
  }
  const { diagnostics } = report;
  switch (section) {
    case 'console':
      return `- console: ${diagnostics.console.length} lines`;
    case 'errors':
      return `- errors: ${diagnostics.errors.length}`;
    case 'breadcrumbs':
      return `- breadcrumbs: ${diagnostics.breadcrumbs.length} actions`;
    case 'network':
      return `- network: ${diagnostics.network.length} requests`;
    case 'performance': {
      const vitals = diagnostics.performance.vitals
        .map(vital => `${vital.name} ${formatVital(vital.value)}`)
        .join(', ');
      return `- performance: ${vitals === '' ? 'no vitals yet' : vitals}`;
    }
    case 'environment': {
      const brands = diagnostics.environment.brands
        .map(brand => `${brand.brand} ${brand.version}`)
        .join(', ');
      return `- environment: ${brands === '' ? 'user agent only' : brands}`;
    }
    default:
      return section satisfies never;
  }
}

function formatVital(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(VITAL_DECIMALS);
}
