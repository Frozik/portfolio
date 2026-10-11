const QUOTE = '"';
const SEPARATOR = ',';
const BYTE_ORDER_MARK = '﻿';
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * RFC 4180 — quoted values may hold separators, quotes (doubled) and line
 * breaks; lines end in CRLF or LF; a leading byte order mark is dropped.
 * Blank lines are skipped, so a trailing line break adds no row.
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let touched = false;

  const endValue = (): void => {
    row.push(value);
    value = '';
    touched = false;
  };
  const endRow = (): void => {
    if (touched || row.length > 0) {
      endValue();
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source.charAt(index);
    if (quoted) {
      if (char !== QUOTE) {
        value += char;
      } else if (source.charAt(index + 1) === QUOTE) {
        value += QUOTE;
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    switch (char) {
      case QUOTE:
        quoted = true;
        touched = true;
        break;
      case SEPARATOR:
        endValue();
        break;
      case '\r':
        break;
      case '\n':
        endRow();
        break;
      default:
        value += char;
        touched = true;
    }
  }
  endRow();
  return rows;
}

function quoted(value: string): string {
  return NEEDS_QUOTES.test(value)
    ? `${QUOTE}${value.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}`
    : value;
}

/** RFC 4180 with CRLF line ends: what spreadsheets and password managers read back. */
export function formatCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(quoted).join(SEPARATOR)).join('\r\n') + '\r\n';
}
