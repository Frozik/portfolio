/** The runtime permissions the app may ask for, each where its use is obvious. */
export type TPermission =
  | 'contacts'
  | 'calendar'
  | 'call-log'
  | 'notifications'
  | 'phone-state'
  | 'sms'
  | 'location'
  | 'background-location';

export type TPermissionState = 'granted' | 'denied' | 'ask';

export interface IPermissions {
  state(permission: TPermission): Promise<TPermissionState>;
  request(permission: TPermission): Promise<TPermissionState>;
}
