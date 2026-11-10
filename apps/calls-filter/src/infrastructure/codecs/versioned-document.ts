import { range } from 'lodash-es';
import { z } from 'zod';

/** One step of a stored document's history: its JSON at version N, as version N + 1 holds it. */
type TMigration = (data: unknown) => unknown;

/**
 * How a kind of stored document grew. Each step takes the document one version up, from the
 * version it is keyed by; 0 is the document as written before documents carried a version.
 * A change of shape bumps `version` and adds the step that moves the old shape to the new.
 */
export interface IDocumentHistory {
  readonly version: number;
  readonly migrations: Readonly<Record<number, TMigration>>;
}

export type TOpenedDocument =
  | { readonly kind: 'current'; readonly data: unknown }
  | { readonly kind: 'migrated'; readonly data: unknown; readonly from: number }
  /** Written by a newer app: left as it is, never overwritten from here. */
  | { readonly kind: 'newer'; readonly version: number }
  | {
      readonly kind: 'unreadable';
      readonly reason: 'not-json' | 'no-migration' | 'migration-failed';
    };

const sealed = z.object({ version: z.number().int().min(1), data: z.unknown() });

/** The text a document is stored as: its data, under the version it was written at. */
export function sealDocument(
  history: IDocumentHistory,
  data: unknown,
  replacer?: (key: string, value: unknown) => unknown
): string {
  return JSON.stringify({ version: history.version, data }, replacer);
}

/** A stored document's data at the current version, carried through each step it misses. */
export function openDocument(text: string, history: IDocumentHistory): TOpenedDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', reason: 'not-json' };
  }
  const envelope = sealed.safeParse(raw);
  const from = envelope.success ? envelope.data.version : 0;
  const data = envelope.success ? envelope.data.data : raw;
  if (from > history.version) {
    return { kind: 'newer', version: from };
  }
  if (from === history.version) {
    return { kind: 'current', data };
  }
  let migrated = data;
  for (const version of range(from, history.version)) {
    const step = history.migrations[version];
    if (step === undefined) {
      return { kind: 'unreadable', reason: 'no-migration' };
    }
    try {
      migrated = step(migrated);
    } catch {
      return { kind: 'unreadable', reason: 'migration-failed' };
    }
  }
  return { kind: 'migrated', data: migrated, from };
}

/** The versions a history has no step from: each one a document of that version cannot pass. */
export function gapsIn(history: IDocumentHistory): readonly number[] {
  return range(0, history.version).filter(version => history.migrations[version] === undefined);
}
