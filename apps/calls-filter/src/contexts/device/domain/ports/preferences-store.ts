import type { IDevicePreferences } from '../preferences';

export interface IPreferencesStore {
  load(): Promise<IDevicePreferences>;
  save(preferences: IDevicePreferences): Promise<void>;
}
