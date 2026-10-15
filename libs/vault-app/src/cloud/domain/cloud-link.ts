/** What the probe found the WebDAV server to support; `null` until a client has probed it. */
export interface IWebDavFeatures {
  readonly conditionalRequests: boolean;
  readonly moveReplace: boolean;
  readonly revisionKind: 'etag' | 'last-modified';
}

export interface IWebDavLink {
  readonly kind: 'webdav';
  /** The folder the vault file sits in. */
  readonly url: string;
  readonly username: string;
  /** The file, relative to the folder. */
  readonly path: string;
  /** The app password and what the server supports; `null` when this device has none sealed. */
  readonly secret: {
    readonly password: string;
    readonly features: IWebDavFeatures | null;
  } | null;
}

export interface IDriveLink {
  readonly kind: 'google-drive';
  readonly space: 'my-drive' | 'app-data';
  readonly path: string;
  /** The Google account that reached the file, named to Google when a token is renewed. */
  readonly account: string | null;
}

/** Where a vault's file lives and how this device reaches it: sealed with the vault's key. */
export type TCloudLink = IWebDavLink | IDriveLink;
