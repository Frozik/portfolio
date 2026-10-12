import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import { vaultFileName } from '@frozik/vault/format/cloud-file-names';
import type { ICloudConnection, IWebDavSecrets, TConnectCloud } from '../domain/ports/cloud';
import type { TOpenGoogleDrive } from '../domain/ports/google-drive';
import type { TProbeWebDav } from '../domain/ports/webdav-prober';
import type { TAdoptFailure } from './cloud-adoption';
import { adoptCloudVault } from './cloud-adoption';
import type { TCloudStep } from './cloud-wizard';
import { cloudStep } from './cloud-wizard';
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

/** A vault about to be created in the checked folder: any vault the device knew before is not it. */
interface IPendingNewVault {
  readonly knownBefore: ReadonlySet<TVaultKey>;
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
  private pendingNew: IPendingNewVault | null = null;
  private readonly controller = new AbortController();

  constructor(
    private readonly services: ICloudSetupServices,
    private readonly registry: VaultRegistryModel
  ) {
    makeAutoObservable<
      CloudSetup,
      'services' | 'registry' | 'pending' | 'pendingNew' | 'controller'
    >(
      this,
      {
        webDavForm: observableRef,
        driveForm: observableRef,
        opening: observableRef,
        services: false,
        registry: false,
        pending: false,
        pendingNew: false,
        controller: false,
      },
      { autoBind: true }
    );
  }

  get step(): TCloudStep {
    return cloudStep(this.driveForm, this.webDavForm);
  }

  /** Back one step: from the vaults to the connection, from the connection to the choice of cloud. */
  back(): void {
    const { step } = this;
    this.opening = { kind: 'idle' };
    switch (step.kind) {
      case 'choose':
        return;
      case 'connect':
        this.closeDriveForm();
        this.closeWebDavForm();
        return;
      case 'pick':
        step.cloud.form.uncheck();
        return;
      default:
        assertNever(step);
    }
  }

  openWebDavForm(): void {
    this.closeDriveForm();
    this.webDavForm ??= new WebDavConnectForm(this.services.probeWebDav);
  }

  closeWebDavForm(): void {
    this.webDavForm?.dispose();
    this.webDavForm = null;
  }

  openDriveForm(): void {
    this.closeWebDavForm();
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

  /**
   * The folder the wizard reached gets the vault about to be created, under
   * its name; `false` when no folder is reached. It is linked once the new
   * vault's session starts.
   */
  prepareNewVaultHere(vaultName: string): boolean {
    const fileName = vaultFileName(vaultName);
    const webDavLink = this.webDavForm?.linkFor(fileName);
    const connection = isNil(webDavLink)
      ? this.driveForm?.connectionFor(fileName)
      : this.services.connectCloud(webDavLink.location, webDavLink.secrets);
    if (isNil(connection)) {
      return false;
    }
    const listed = this.registry.vaults.value ?? [];
    this.pendingNew = {
      knownBefore: new Set(listed.map(vault => vault.vaultKey)),
      connection,
      secrets: webDavLink?.secrets ?? null,
    };
    return true;
  }

  /** At unlock: a vault just opened from a cloud or made in one is linked to it, any other picks its own link up again. */
  attachTo(session: VaultSession): void {
    const { pending, pendingNew } = this;
    this.pendingNew = null;
    if (!isNil(pending) && pending.vaultKey === session.vaultKey) {
      this.pending = null;
      void this.keepIn(session, pending.connection, pending.secrets);
      return;
    }
    if (!isNil(pendingNew) && !pendingNew.knownBefore.has(session.vaultKey)) {
      this.closeWebDavForm();
      this.driveForm = null;
      void this.keepIn(session, pendingNew.connection, pendingNew.secrets);
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
