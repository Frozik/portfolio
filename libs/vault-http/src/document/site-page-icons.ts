import { isNil } from 'lodash-es';

const LINK_TAG = /<link\b[^>]*>/gi;
const ATTRIBUTE = /([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const ABSOLUTE = /^https?:\/\//i;
const ORIGIN = /^https?:\/\/[^/?#]+/i;
const VECTOR = /\.svg(?:[?#]|$)/i;
/** Android draws no SVG, and a site lists its icons from the best down only by its own whim. */
const MOST_TRIED = 3;
const FAVICON_PATH = '/favicon.ico';
/** A link with no sizes is taken for a tab's icon, the smallest kind. */
const UNSIZED = 16;

interface IIconLink {
  readonly url: string;
  readonly touch: boolean;
  readonly side: number;
}

function attributesOf(tag: string): ReadonlyMap<string, string> {
  return new Map(
    Array.from(tag.matchAll(ATTRIBUTE), ([, name = '', double, single, bare]) => [
      name.toLowerCase(),
      (double ?? single ?? bare ?? '').replaceAll('&amp;', '&'),
    ])
  );
}

function resolve(href: string, origin: string): string {
  if (ABSOLUTE.test(href)) {
    return href;
  }
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  return href.startsWith('/') ? `${origin}${href}` : `${origin}/${href}`;
}

function sideOf(sizes: string | undefined): number {
  const sides = (sizes ?? '').split(/\s+/).map(size => Number.parseInt(size, 10));
  return Math.max(UNSIZED, ...sides.filter(Number.isFinite));
}

/**
 * The icons a site's page names, the best for a phone first: a home-screen icon, then the largest
 * one, never a vector; the site's `/favicon.ico` when the page names none.
 */
export function siteIconLinks(html: string, pageUrl: string): readonly string[] {
  const origin = ORIGIN.exec(pageUrl)?.[0];
  if (isNil(origin)) {
    return [];
  }
  const links = Array.from(html.matchAll(LINK_TAG), ([tag]) => attributesOf(tag)).flatMap(
    (attributes): IIconLink[] => {
      const rel = (attributes.get('rel') ?? '').toLowerCase();
      const href = attributes.get('href');
      if (!rel.includes('icon') || isNil(href) || href === '' || href.startsWith('data:')) {
        return [];
      }
      if (attributes.get('type') === 'image/svg+xml' || VECTOR.test(href)) {
        return [];
      }
      return [
        {
          url: resolve(href, origin),
          touch: rel.includes('apple-touch-icon'),
          side: sideOf(attributes.get('sizes')),
        },
      ];
    }
  );
  const best = links
    .toSorted((left, right) => Number(right.touch) - Number(left.touch) || right.side - left.side)
    .map(link => link.url);
  return best.length === 0 ? [`${origin}${FAVICON_PATH}`] : [...new Set(best)].slice(0, MOST_TRIED);
}
