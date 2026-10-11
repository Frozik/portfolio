import type { ITextSegment, TInputNormalizer } from './defs';

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const AUTHORITY_END = /[/?#]/;
const WHITESPACE = /\s+/g;

export interface IUrlClassNames {
  readonly dim: string;
  readonly host: string;
}

/** An address has no spaces; pasted ones go, and the caret stays with its characters. */
export const normalizeUrlInput: TInputNormalizer = (value, selection) => {
  const before = value.slice(0, selection.start).replace(WHITESPACE, '').length;
  const through = value.slice(0, selection.end).replace(WHITESPACE, '').length;
  return { value: value.replace(WHITESPACE, ''), selection: { start: before, end: through } };
};

interface IUrlParts {
  readonly beforeHost: string;
  readonly host: string;
  readonly afterHost: string;
}

function splitUrl(text: string): IUrlParts {
  const scheme = SCHEME.exec(text)?.[0] ?? '';
  const afterScheme = text.slice(scheme.length);
  const authorityLength = afterScheme.search(AUTHORITY_END);
  const authority = authorityLength < 0 ? afterScheme : afterScheme.slice(0, authorityLength);
  const rest = afterScheme.slice(authority.length);
  const credentialsEnd = authority.lastIndexOf('@') + 1;
  const hostAndPort = authority.slice(credentialsEnd);
  const portStart = hostAndPort.search(/:\d*$/);
  const host = portStart < 0 ? hostAndPort : hostAndPort.slice(0, portStart);
  return {
    beforeHost: scheme + authority.slice(0, credentialsEnd),
    host,
    afterHost: hostAndPort.slice(host.length) + rest,
  };
}

/**
 * The host stands out, everything else is dimmed: scheme,
 * credentials, port, path. `https://bank.example@evil.example/login` shows
 * `evil.example` bright — the site the address really goes to.
 */
export function urlSegments(text: string, classNames: IUrlClassNames): readonly ITextSegment[] {
  const { beforeHost, host, afterHost } = splitUrl(text);
  const parts: readonly ITextSegment[] = [
    { text: beforeHost, className: classNames.dim },
    { text: host, className: classNames.host },
    { text: afterHost, className: classNames.dim },
  ];
  return parts.filter(part => part.text !== '');
}

const NON_ASCII = /[\u0080-\u{10FFFF}]/u;

/**
 * The ASCII form of an internationalised host (`xn--…`), the
 * one the browser really connects to: `аpple.com` with a Cyrillic `а` reads
 * as Apple but is another site. Absent for a plain ASCII host.
 */
export function punycodeHostOf(text: string): string | undefined {
  const { host } = splitUrl(text);
  if (!NON_ASCII.test(host) || !URL.canParse(`http://${host}`)) {
    return undefined;
  }
  return new URL(`http://${host}`).hostname;
}
