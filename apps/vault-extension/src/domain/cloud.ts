import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { z } from 'zod';

/** A vault file in a WebDAV folder. */
export interface IWebDavSource {
  readonly folderUrl: string;
  readonly username: string;
  readonly fileName: string;
}

/** A vault file in Google Drive, and the Google account that reached it. */
export interface IDriveSource {
  readonly space: TDriveSpace;
  readonly path: string;
  /** Named to Google when the hour-long token is renewed without a window. */
  readonly account: string | null;
}

/** Where the vault's file is and how to reach it: sealed with the vault's key, never kept in the open. */
export type TCloudLink =
  | { readonly kind: 'webdav'; readonly source: IWebDavSource; readonly password: string }
  | { readonly kind: 'google-drive'; readonly source: IDriveSource };

/** A link read back from storage: anything else is no link. */
export const CLOUD_LINK_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('webdav'),
    source: z.object({ folderUrl: z.string(), username: z.string(), fileName: z.string() }),
    password: z.string().min(1),
  }),
  z.object({
    kind: z.literal('google-drive'),
    source: z.object({
      space: z.enum(['my-drive', 'app-data']),
      path: z.string().min(1),
      account: z.string().nullable(),
    }),
  }),
]) satisfies z.ZodType<TCloudLink>;

export type TConnectOutcome =
  | 'connected'
  | 'not-found'
  | 'not-a-vault'
  | 'unreachable'
  | 'signed-out';

/**
 * What a pull did to the copy: nothing new, a newer file, a file under a key this session no longer
 * has; or Google wants the user to sign in again.
 */
export type TPullOutcome =
  | 'unchanged'
  | 'updated'
  | 'rotated'
  | 'unreachable'
  | 'signed-out'
  | 'no-cloud';

/** Why Google's sign-in gave no token, with what Chrome or Google said about it. */
export interface IDriveSignInFailure {
  readonly kind:
    | 'cancelled'
    /** Google answered with an error, or without the Drive permission. */
    | 'refused'
    /** Chrome could not run the sign-in (the window did not load, the address was refused). */
    | 'failed'
    /** The extension was built without the vault's OAuth client. */
    | 'unavailable';
  readonly detail: string | null;
}

/** The vault files in a Drive folder, found after Google's sign-in. */
export type TDriveSearch =
  | {
      readonly kind: 'found';
      readonly space: TDriveSpace;
      readonly account: string | null;
      readonly paths: readonly string[];
    }
  | {
      readonly kind: 'failed';
      readonly reason: IDriveSignInFailure['kind'] | 'unreachable';
      readonly detail: string | null;
    };
