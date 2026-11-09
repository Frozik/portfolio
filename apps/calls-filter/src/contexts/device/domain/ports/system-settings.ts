/** Where in Android's settings a permission the app can no longer ask for is switched on. */
export type TSettingsPlace = 'app-permissions' | 'notifications' | 'default-apps' | 'add-account';

export type TOpenSystemSettings = (place: TSettingsPlace) => void;
