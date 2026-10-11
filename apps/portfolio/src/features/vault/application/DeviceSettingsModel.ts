import type { Milliseconds } from '@frozik/utils/date/types';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';
import { z } from 'zod';

import type { IDeviceSettings } from '../domain/device-settings';
import { DEFAULT_DEVICE_SETTINGS } from '../domain/device-settings';

const DEVICE_SETTINGS_SCHEMA = z.object({
  lock: z.object({
    idle: z.number().positive(),
    hidden: z.number().nonnegative().nullable(),
  }),
  clipboardClearMs: z.number().positive(),
  checkLeaks: z.boolean().default(false),
  loadSiteIcons: z.boolean().default(true),
});

/** A stored record that no longer reads as settings falls back to the defaults, never fails the session. */
export function decodeDeviceSettings(value: unknown): IDeviceSettings | null {
  const parsed = DEVICE_SETTINGS_SCHEMA.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const { lock, clipboardClearMs, checkLeaks, loadSiteIcons } = parsed.data;
  return {
    lock: {
      idle: lock.idle as Milliseconds,
      hidden: isNil(lock.hidden) ? null : (lock.hidden as Milliseconds),
    },
    clipboardClearMs: clipboardClearMs as Milliseconds,
    checkLeaks,
    loadSiteIcons,
  };
}

/** This device's timeouts for this vault, sealed in its device store. */
export class DeviceSettingsModel {
  settings: IDeviceSettings = DEFAULT_DEVICE_SETTINGS;

  private saving: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> = Promise.resolve();
  private frozen = false;
  /** A change made before the stored settings arrived: the late load does not undo it. */
  private changed = false;

  constructor(private readonly record: ISealedJsonRecord<IDeviceSettings>) {
    makeAutoObservable<DeviceSettingsModel, 'record' | 'saving' | 'loading' | 'frozen' | 'changed'>(
      this,
      {
        settings: observableRef,
        record: false,
        saving: false,
        loading: false,
        frozen: false,
        changed: false,
      },
      { autoBind: true }
    );
  }

  load(): Promise<void> {
    this.loading = this.record.load().then(stored => {
      runInAction(() => {
        if (!isNil(stored) && !this.changed) {
          this.settings = stored;
        }
      });
    });
    return this.loading;
  }

  /** The stored settings have been read (or there were none): what the screen shows is this device's. */
  loaded(): Promise<void> {
    return this.loading;
  }

  update(change: Partial<IDeviceSettings>): void {
    this.changed = true;
    this.settings = { ...this.settings, ...change };
    if (!this.frozen) {
      this.saving = this.record.save(this.settings);
    }
  }

  /** A rotation re-seals the stored settings: a change from now on stays in memory. */
  freeze(): void {
    this.frozen = true;
  }

  /** The last change is sealed: a key rotation re-seals what is stored, not what is on its way. */
  saved(): Promise<unknown> {
    return this.saving;
  }
}
