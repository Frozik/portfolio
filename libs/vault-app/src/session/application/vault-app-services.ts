import type { IVaultRegistry, TPersisted, TVaultKey } from '@frozik/vault/persistence/ports';

import type { IStrengthMeter } from '../../audit/domain/ports/strength-meter';
import type { TOpenGoogleDrive } from '../../cloud/domain/ports/google-drive';
import type { TPickVaultFile } from '../../cloud/domain/ports/vault-file-picker';
import type { TProbeWebDav } from '../../cloud/domain/ports/webdav-prober';
import type { IThemeStore } from '../../device/domain/ports/theme-store';
import type { IDeviceUnlock } from '../../keys/domain/ports/device-unlock';
import type { IVaultOpeningServices } from '../../sync/application/vault-opening';
import type { IDemoSeed } from '../domain/ports/demo-seed';
import type { ISessionKeyCustody } from '../domain/ports/key-custody';
import type { IProcessWipe } from '../domain/ports/process-wipe';
import type { IQuickPepper } from '../domain/ports/quick-pepper';
import type { IVaultFlowServices } from './VaultFlows';

/** What the vault app needs from its platform, wired once by each client's composition root. */
export interface IVaultAppServices extends IVaultOpeningServices, IVaultFlowServices {
  readonly registry: IVaultRegistry;
  /** The made-up vault a showcase offers; `null` in the product. */
  readonly demo: IDemoSeed | null;
  /** A dying process is the only real wipe; the same URL comes back locked. */
  readonly wipe: IProcessWipe;
  readonly custody: ISessionKeyCustody;
  readonly pepper: IQuickPepper;
  /** The platform's biometric unlock; `null` where there is none (the web: passkeys instead). */
  readonly deviceUnlock: IDeviceUnlock | null;
  readonly themeStore: IThemeStore;
  readonly disposeCodec: () => void;
  readonly createStrengthMeter: () => IStrengthMeter;
  readonly probeWebDav: TProbeWebDav;
  readonly openGoogleDrive: TOpenGoogleDrive;
  /** The platform's file chooser for opening a `.pwv`; `null` where opening a file is not offered. */
  readonly pickVaultFile: TPickVaultFile | null;
  /** This device forgets one vault: its records and what it saw of it. */
  readonly forgetOnDevice: (vaultKey: TVaultKey) => TPersisted<void>;
}
