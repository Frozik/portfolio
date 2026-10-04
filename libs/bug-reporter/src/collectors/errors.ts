import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { isNil } from 'lodash-es';
import '../platform/browser-apis';

import type { TNow } from '../core/clock';
import type { IErrorEntry } from '../core/report';
import { describeValue } from '../core/safe-serialize';
import { sanitizeUrl } from '../core/sanitize-url';
import { listen } from './listen';

type TPush = (entry: Omit<IErrorEntry, 'timestamp' | 'count'>) => void;

/** Uncaught exceptions, rejected promises, failed resources, CSP violations and browser deprecation reports. */
export function captureErrors(push: (entry: IErrorEntry) => void, now: TNow): () => void {
  const record: TPush = entry => push({ ...entry, timestamp: now(), count: 1 });
  const bag = new DisposableBag();
  bag.add(listen(window, 'error', event => recordErrorEvent(event, record), true));
  bag.add(listen(window, 'unhandledrejection', event => recordRejection(event, record)));
  bag.add(listen(document, 'securitypolicyviolation', event => recordCspViolation(event, record)));
  if (typeof ReportingObserver === 'function') {
    const observer = new ReportingObserver(
      reports => reports.forEach(report => recordReport(report, record)),
      {
        types: ['deprecation', 'intervention'],
        buffered: true,
      }
    );
    observer.observe();
    bag.add(() => observer.disconnect());
  }
  return () => bag.disposeAll();
}

export function coalesceErrors(last: IErrorEntry, next: IErrorEntry): IErrorEntry | undefined {
  return last.kind === next.kind && last.message === next.message && last.source === next.source
    ? { ...last, count: last.count + next.count }
    : undefined;
}

function recordErrorEvent(event: Event, record: TPush): void {
  if (event instanceof ErrorEvent) {
    const stack = event.error instanceof Error ? (event.error.stack ?? null) : null;
    record({
      kind: 'uncaught',
      message: event.message,
      stack,
      source: event.filename === '' ? null : `${event.filename}:${event.lineno}:${event.colno}`,
    });
    return;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const url = target.getAttribute('src') ?? target.getAttribute('href');
  record({
    kind: 'resource',
    message: `Failed to load <${target.tagName.toLowerCase()}>`,
    stack: null,
    source: url === null ? null : sanitizeUrl(url, location.href),
  });
}

function recordRejection(event: PromiseRejectionEvent, record: TPush): void {
  const reason: unknown = event.reason;
  const stack = reason instanceof Error ? (reason.stack ?? null) : null;
  const message =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : describeValue(reason);
  record({ kind: 'unhandledrejection', message, stack, source: null });
}

function recordCspViolation(event: SecurityPolicyViolationEvent, record: TPush): void {
  record({
    kind: 'csp',
    message: `${event.violatedDirective} blocked ${event.blockedURI}`,
    stack: null,
    source: event.sourceFile === '' ? null : `${event.sourceFile}:${event.lineNumber}`,
  });
}

function recordReport(report: Report, record: TPush): void {
  const body: ReportingDeprecationBody | null | undefined = report.body;
  if (isNil(body)) {
    return;
  }
  const message = [body.id, body.message].filter(part => !isNil(part) && part !== '').join(': ');
  record({
    kind: 'deprecation',
    message: `${report.type ?? 'report'}: ${message}`,
    stack: null,
    source: isNil(body.sourceFile) ? null : `${body.sourceFile}:${body.lineNumber ?? 0}`,
  });
}
