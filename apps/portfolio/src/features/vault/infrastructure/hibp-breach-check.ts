import { isNil } from 'lodash-es';

import type { IBreachCheck } from '../domain/ports/audit-sources';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const PREFIX_CHARS = 5;
const HEX_RADIX = 16;
const LINE_BREAK = /\r?\n/;

async function sha1Hex(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), byte => byte.toString(HEX_RADIX).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** `SUFFIX:COUNT` per line; padding lines carry a count of 0. */
function countsOf(body: string): ReadonlyMap<string, number> {
  return new Map(
    body.split(LINE_BREAK).flatMap(line => {
      const [suffix, count] = line.trim().split(':');
      const times = Number(count);
      return isNil(suffix) || !Number.isFinite(times) ? [] : [[suffix, times] as const];
    })
  );
}

/**
 * K-anonymity: only the first five hex digits of the SHA-1
 * leave the page, with `Add-Padding` so the answer's size says nothing; one
 * request per prefix per session.
 */
export function createHibpBreachCheck(): IBreachCheck {
  const ranges = new Map<string, Promise<ReadonlyMap<string, number> | null>>();
  const rangeOf = (prefix: string, signal: AbortSignal) => {
    const known = ranges.get(prefix);
    if (!isNil(known)) {
      return known;
    }
    const loading = fetch(`${RANGE_URL}${prefix}`, { headers: { 'Add-Padding': 'true' }, signal })
      .then(async response => (response.ok ? countsOf(await response.text()) : null))
      .catch(() => null);
    ranges.set(prefix, loading);
    void loading.then(range => {
      if (isNil(range)) {
        ranges.delete(prefix);
      }
    });
    return loading;
  };
  return {
    async count(password, signal) {
      const hash = await sha1Hex(password);
      const range = await rangeOf(hash.slice(0, PREFIX_CHARS), signal);
      return isNil(range) ? null : (range.get(hash.slice(PREFIX_CHARS)) ?? 0);
    },
  };
}
