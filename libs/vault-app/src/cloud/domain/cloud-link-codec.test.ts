import type { TCloudLink } from './cloud-link';
import { decodeCloudLink, encodeCloudLink } from './cloud-link-codec';

const FEATURES = { conditionalRequests: true, moveReplace: true, revisionKind: 'etag' } as const;

const WEBDAV: TCloudLink = {
  kind: 'webdav',
  url: 'https://dav.example.org/Vaults/',
  username: 'me',
  path: 'Family.pwv',
  secret: { password: 'app-password', features: FEATURES },
};
const DRIVE: TCloudLink = {
  kind: 'google-drive',
  space: 'app-data',
  path: 'Family.pwv',
  account: 'jane@example.org',
};

describe('a cloud link record', () => {
  it.each([
    ['WebDAV', WEBDAV],
    ['Google Drive', DRIVE],
  ])('of %s reads back as written, as version 2', (_kind, link) => {
    expect(decodeCloudLink(JSON.parse(JSON.stringify(encodeCloudLink(link))))).toEqual({
      link,
      legacy: false,
    });
  });

  it('of the 2026-10 web app reads with its WebDAV secrets', () => {
    const written = {
      location: { kind: 'webdav', url: WEBDAV.url, username: 'me', path: 'Family.pwv' },
      webdav: { password: 'app-password', features: FEATURES },
    };

    expect(decodeCloudLink(written)).toEqual({ link: WEBDAV, legacy: true });
  });

  it('of the 2026-10 web app reads a Drive file with no account', () => {
    const written = {
      location: { kind: 'google-drive', space: 'app-data', path: 'Family.pwv' },
      webdav: null,
    };

    expect(decodeCloudLink(written)).toEqual({
      link: { ...DRIVE, account: null },
      legacy: true,
    });
  });

  it('of the 2026-10 extension reads WebDAV with features still to probe', () => {
    const written = {
      kind: 'webdav',
      source: { folderUrl: WEBDAV.url, username: 'me', fileName: 'Family.pwv' },
      password: 'app-password',
    };

    expect(decodeCloudLink(written)).toEqual({
      link: { ...WEBDAV, secret: { password: 'app-password', features: null } },
      legacy: true,
    });
  });

  it('of the 2026-10 extension reads a Drive file with its account', () => {
    const written = {
      kind: 'google-drive',
      source: { space: 'app-data', path: 'Family.pwv', account: 'jane@example.org' },
    };

    expect(decodeCloudLink(written)).toEqual({ link: DRIVE, legacy: true });
  });

  it.each([null, {}, { version: 3, link: DRIVE }, { kind: 'webdav', source: {}, password: '' }])(
    'that no client wrote is no link: %j',
    value => {
      expect(decodeCloudLink(value)).toBeNull();
    }
  );
});
