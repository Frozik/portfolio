import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import { vaultFileName } from '../domain/cloud-files';
import type { ICloudConnection, IWebDavSecrets, TConnectCloud } from '../domain/ports/cloud';
import type { TOpenGoogleDrive } from '../domain/ports/google-drive';
import type { TProbeWebDav } from '../domain/ports/webdav-prober';
import type { TAdoptFailure } from './cloud-adoption';
import { adoptCloudVault } from './cloud-adoption';
import { GoogleDriveConnectForm } from './GoogleDriveConnectForm';
import type { VaultRegistryModel } from './VaultRegistryModel';
import type { VaultSession } from './VaultSession';
import { WebDavConnectForm } from './WebDavConnectForm';

export interface ICloudSetupServices {
  readonly probeWebDav: TProbeWebDav;
  readonly openGoogleDrive: TOpenGoogleDrive;
  readonly connectCloud: TConnectCloud;
  readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
  readonly registry: IVaultRegistry;
}

export type TCloudOpening =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  | { readonly kind: 'failed'; readonly failure: TAdoptFailure };

interface IPendingLink {
  readonly vaultKey: TVaultKey;
  readonly connection: ICloudConnection;
  readonly secrets: IWebDavSecrets | null;
}

/**
 * The Drive and WebDAV
 * forms, keeping the open vault in a cloud or leaving it, and opening a vault
 * found in a cloud on this device: downloaded, then linked once unlocked
 * (the WebDAV secrets can only be sealed with the vault's key).
 */
export class CloudSetup {
  webDavForm: WebDavConnectForm | null = null;
  driveForm: GoogleDriveConnectForm | null = null;
  opening: TCloudOpening = { kind: 'idle' };

  private pending: IPendingLink | null = null;
  private readonly controller = new AbortController();

  constructor(
    private readonly services: ICloudSetupServices,
    private readonly registry: VaultRegistryModel
  ) {
    makeAutoObservable<CloudSetup, 'services' | 'registry' | 'pending' | 'controller'>(
      this,
      {
        webDavForm: observableRef,
        driveForm: observableRef,
        opening: observableRef,
        services: false,
        registry: false,
        pending: false,
        controller: false,
      },
      { autoBind: true }
    );
  }

  openWebDavForm(): void {
    this.webDavForm ??= new WebDavConnectForm(this.services.probeWebDav);
  }

  closeWebDavForm(): void {
    this.webDavForm?.dispose();
    this.webDavForm = null;
  }

  openDriveForm(): void {
    this.driveForm ??= new GoogleDriveConnectForm(this.services.openGoogleDrive);
  }

  closeDriveForm(): void {
    this.driveForm?.dispose();
    this.driveForm = null;
  }

  /** The open vault starts living in the WebDAV folder the form checked. */
  async keepInWebDav(session: VaultSession): Promise<void> {
    const link = this.webDavForm?.linkFor(vaultFileName(session.document.settings.name));
    const connection = isNil(link) ? null : this.services.connectCloud(link.location, link.secrets);
    if (isNil(link) || isNil(connection)) {
      return;
    }
    this.closeWebDavForm();
    await this.keepIn(session, connection, link.secrets);
  }

  /** The open vault starts living in the Drive space the user signed in to. */
  async keepInDrive(session: VaultSession): Promise<void> {
    const connection = this.driveForm?.connectionFor(vaultFileName(session.document.settings.name));
    if (isNil(connection)) {
      return;
    }
    this.driveForm = null;
    await this.keepIn(session, connection, null);
  }

  /** The vault stays on this device only; the cloud file is left where it is. */
  async disconnect(session: VaultSession): Promise<void> {
    await session.cloud.unlink();
  }

  /** A vault found in the checked WebDAV folder; its key, once it is on this device. */
  async openFromWebDav(path: TStoragePath): Promise<TVaultKey | null> {
    const link = this.webDavForm?.linkFor(path);
    const connection = isNil(link) ? null : this.services.connectCloud(link.location, link.secrets);
    return isNil(link) || isNil(connection) ? null : this.adopt(connection, link.secrets);
  }

  /** A vault found in the signed-in Drive space. */
  async openFromDrive(path: TStoragePath): Promise<TVaultKey | null> {
    const connection = this.driveForm?.connectionAt(path);
    return isNil(connection) ? null : this.adopt(connection, null);
  }

  /** At unlock: a vault just opened from a cloud is linked to it, any other picks its own link up again. */
  attachTo(session: VaultSession): void {
    const { pending } = this;
    if (!isNil(pending) && pending.vaultKey === session.vaultKey) {
      this.pending = null;
      void this.keepIn(session, pending.connection, pending.secrets);
      return;
    }
    void session.cloud.restore();
  }

  dispose(): void {
    this.controller.abort();
    this.closeWebDavForm();
    this.closeDriveForm();
  }

  private async adopt(
    connection: ICloudConnection,
    secrets: IWebDavSecrets | null
  ): Promise<TVaultKey | null> {
    this.opening = { kind: 'opening' };
    const adopted = await adoptCloudVault(
      {
        connection,
        localCopyOf: this.services.localCopyOf,
        registry: this.services.registry,
      },
      this.controller.signal
    );
    runInAction(() => {
      this.opening = adopted.ok ? { kind: 'idle' } : { kind: 'failed', failure: adopted.error };
      if (adopted.ok) {
        this.pending = { vaultKey: adopted.value, connection, secrets };
        this.closeWebDavForm();
        this.driveForm = null;
      }
    });
    await this.registry.refresh();
    return adopted.ok ? adopted.value : null;
  }

  private async keepIn(
    session: VaultSession,
    connection: ICloudConnection,
    secrets: IWebDavSecrets | null
  ): Promise<void> {
    await session.cloud.link(connection, secrets);
  }
}
