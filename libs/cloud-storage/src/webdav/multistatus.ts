import { XMLParser } from 'fast-xml-parser';
import { isNil, isPlainObject } from 'lodash-es';

/** One `<response>` of a PROPFIND answer, before it is known which storage path it names. */
export interface IDavEntry {
  readonly href: string;
  readonly isFolder: boolean;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly size: number;
}

export const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop>' +
  '<d:resourcetype/><d:getetag/><d:getlastmodified/><d:getcontentlength/>' +
  '</d:prop></d:propfind>';

const REPEATED = new Set(['response', 'propstat']);
const FOUND_STATUS = / 200 /;

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: true,
  isArray: tagName => REPEATED.has(tagName),
});

type TXmlNode = Readonly<Record<string, unknown>>;

function nodeOf(value: unknown): TXmlNode {
  return isPlainObject(value) ? (value as TXmlNode) : {};
}

function nodesOf(value: unknown): readonly TXmlNode[] {
  return Array.isArray(value) ? value.map(nodeOf) : [];
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function entryOf(response: TXmlNode): IDavEntry | null {
  const href = textOf(response['href']);
  const found = nodesOf(response['propstat']).find(propstat =>
    FOUND_STATUS.test(textOf(propstat['status']) ?? '')
  );
  if (isNil(href) || isNil(found)) {
    return null;
  }
  const prop = nodeOf(found['prop']);
  return {
    href,
    isFolder: 'collection' in nodeOf(prop['resourcetype']),
    etag: textOf(prop['getetag']),
    lastModified: textOf(prop['getlastmodified']),
    size: Number(textOf(prop['getcontentlength']) ?? 0),
  };
}

/** RFC 4918 §14.16 — the entries of a `207 Multi-Status` answer, whatever namespace prefix the server chose. */
export function parseMultistatus(xml: string): readonly IDavEntry[] {
  const document = nodeOf(parser.parse(xml));
  return nodesOf(nodeOf(document['multistatus'])['response'])
    .map(entryOf)
    .filter(entry => !isNil(entry));
}
