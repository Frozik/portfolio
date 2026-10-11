import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { IAccessTokenSource } from '@frozik/cloud-storage/google-drive/access-token';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import type { TResult } from '@frozik/utils/result/result';

export type TGoogleAuthFailure =
  /** The Google script could not load (offline, blocked by an extension). */
  | 'unavailable'
  | 'popup-blocked'
  | 'popup-closed'
  /** The user signed in but unticked the Drive permission on the consent screen. */
  | 'scope-denied'
  | 'refused';

/** Google sign-in for one Drive space; a token lives about an hour. */
export interface IGoogleDriveAuth extends IAccessTokenSource {
  /** Loads Google's script ahead of the click, so the popup opens inside the user's gesture. */
  prepare(): Promise<boolean>;
  /** Must be called synchronously from a click handler: GIS opens its popup there or not at all. */
  authorize(): Promise<TResult<void, TGoogleAuthFailure>>;
}

export interface IGoogleDrive {
  readonly auth: IGoogleDriveAuth;
  readonly storage: IStorageProvider;
}

export type TOpenGoogleDrive = (space: TDriveSpace) => IGoogleDrive;
