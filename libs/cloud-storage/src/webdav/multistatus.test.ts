import { Temporal } from 'temporal-polyfill';

import { parseHttpDate } from './http-date';
import { parseMultistatus } from './multistatus';

describe('PROPFIND answers', () => {
  it('reads files and folders whatever namespace prefix the server chose, skipping missing props', () => {
    const xml =
      '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:oc="http://owncloud.org/ns">' +
      '<response><href>/dav/Vault/</href><propstat><prop><resourcetype><collection/></resourcetype></prop>' +
      '<status>HTTP/1.1 200 OK</status></propstat></response>' +
      '<response><href>/dav/Vault/my%20vault.pwv</href>' +
      '<propstat><prop><resourcetype/><getetag>"abc"</getetag><getcontentlength>42</getcontentlength>' +
      '<getlastmodified>Sun, 11 Oct 2026 13:03:07 GMT</getlastmodified></prop><status>HTTP/1.1 200 OK</status></propstat>' +
      '<propstat><prop><oc:size/></prop><status>HTTP/1.1 404 Not Found</status></propstat></response>' +
      '</multistatus>';

    expect(parseMultistatus(xml)).toEqual([
      { href: '/dav/Vault/', isFolder: true, etag: null, lastModified: null, size: 0 },
      {
        href: '/dav/Vault/my%20vault.pwv',
        isFolder: false,
        etag: '"abc"',
        lastModified: 'Sun, 11 Oct 2026 13:03:07 GMT',
        size: 42,
      },
    ]);
  });

  it('reads the HTTP date a server gives, and nothing else', () => {
    expect(parseHttpDate('Sun, 11 Oct 2026 13:03:07 GMT')).toBe(
      Temporal.Instant.from('2026-10-11T13:03:07Z').epochMilliseconds
    );
    expect(parseHttpDate('2026-10-11T13:03:07Z')).toBeNull();
  });
});
