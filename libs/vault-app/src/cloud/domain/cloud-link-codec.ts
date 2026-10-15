import { z } from 'zod';

import type { TCloudLink } from './cloud-link';

const LINK_VERSION = 2;

const FEATURES_SCHEMA = z.object({
  conditionalRequests: z.boolean(),
  moveReplace: z.boolean(),
  revisionKind: z.enum(['etag', 'last-modified']),
});
const SPACE_SCHEMA = z.enum(['my-drive', 'app-data']);

const V2_SCHEMA = z.object({
  version: z.literal(LINK_VERSION),
  link: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('webdav'),
      url: z.string(),
      username: z.string(),
      path: z.string(),
      secret: z
        .object({ password: z.string().min(1), features: FEATURES_SCHEMA.nullable() })
        .nullable(),
    }),
    z.object({
      kind: z.literal('google-drive'),
      space: SPACE_SCHEMA,
      path: z.string(),
      account: z.string().nullable(),
    }),
  ]),
});

/** The web app's record before version 2. */
const WEB_V1_SCHEMA = z.object({
  location: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('google-drive'), space: SPACE_SCHEMA, path: z.string() }),
    z.object({
      kind: z.literal('webdav'),
      url: z.string(),
      username: z.string(),
      path: z.string(),
    }),
  ]),
  webdav: z.object({ password: z.string().min(1), features: FEATURES_SCHEMA }).nullable(),
});

/** The extension's record before version 2. */
const EXTENSION_V1_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('webdav'),
    source: z.object({ folderUrl: z.string(), username: z.string(), fileName: z.string() }),
    password: z.string().min(1),
  }),
  z.object({
    kind: z.literal('google-drive'),
    source: z.object({
      space: SPACE_SCHEMA,
      path: z.string().min(1),
      account: z.string().nullable(),
    }),
  }),
]);

export interface IDecodedCloudLink {
  readonly link: TCloudLink;
  /** Written by an older client: worth writing again as version 2. */
  readonly legacy: boolean;
}

/** The web app's own record shape: where the file is, and the WebDAV secrets it sealed. */
export type TWebLinkRecord = z.infer<typeof WEB_V1_SCHEMA>;

export function linkOfWebRecord({ location, webdav }: TWebLinkRecord): TCloudLink {
  return location.kind === 'webdav'
    ? { ...location, secret: webdav }
    : { ...location, account: null };
}

function fromExtensionV1(record: z.infer<typeof EXTENSION_V1_SCHEMA>): TCloudLink {
  if (record.kind === 'google-drive') {
    return { kind: 'google-drive', ...record.source };
  }
  const { folderUrl, username, fileName } = record.source;
  return {
    kind: 'webdav',
    url: folderUrl,
    username,
    path: fileName,
    secret: { password: record.password, features: null },
  };
}

/** Any record a client wrote, version 2 or older; anything else is no link. */
export function decodeCloudLink(value: unknown): IDecodedCloudLink | null {
  const current = V2_SCHEMA.safeParse(value);
  if (current.success) {
    return { link: current.data.link, legacy: false };
  }
  const web = WEB_V1_SCHEMA.safeParse(value);
  if (web.success) {
    return { link: linkOfWebRecord(web.data), legacy: true };
  }
  const extension = EXTENSION_V1_SCHEMA.safeParse(value);
  return extension.success ? { link: fromExtensionV1(extension.data), legacy: true } : null;
}

export function encodeCloudLink(link: TCloudLink): z.infer<typeof V2_SCHEMA> {
  return { version: LINK_VERSION, link };
}
