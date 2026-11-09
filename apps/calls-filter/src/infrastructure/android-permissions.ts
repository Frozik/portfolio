import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Permission } from 'react-native';
import { PermissionsAndroid } from 'react-native';

import type {
  IPermissions,
  TPermission,
  TPermissionState,
} from '../contexts/device/domain/ports/permissions';

/**
 * Each permission is the one the app reads with. The Expo contacts and calendar modules ask
 * for writing too, which the app never needs, and would report «not granted» without it.
 */
function androidPermission(permission: TPermission): Permission {
  switch (permission) {
    case 'contacts':
      return PermissionsAndroid.PERMISSIONS.READ_CONTACTS;
    case 'calendar':
      return PermissionsAndroid.PERMISSIONS.READ_CALENDAR;
    case 'call-log':
      return PermissionsAndroid.PERMISSIONS.READ_CALL_LOG;
    case 'notifications':
      return PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    case 'phone-state':
      return PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;
    case 'sms':
      return PermissionsAndroid.PERMISSIONS.SEND_SMS;
    case 'location':
      return PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    case 'background-location':
      return PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
    default:
      return assertNever(permission);
  }
}

function stateOf(result: string): TPermissionState {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'denied' : 'ask';
}

export const ANDROID_PERMISSIONS: IPermissions = {
  state: async permission =>
    (await PermissionsAndroid.check(androidPermission(permission))) ? 'granted' : 'ask',
  request: async permission =>
    stateOf(await PermissionsAndroid.request(androidPermission(permission))),
};
