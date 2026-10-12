/** Where a vault lives in a cloud; never a password or a token. On the device it is sealed with the vault's key. */
export type TCloudLocation =
  | {
      readonly kind: 'google-drive';
      /** A visible folder in My Drive, or the app's hidden one. */
      readonly space: 'my-drive' | 'app-data';
      readonly path: string;
    }
  | {
      readonly kind: 'webdav';
      readonly url: string;
      readonly username: string;
      readonly path: string;
    };
