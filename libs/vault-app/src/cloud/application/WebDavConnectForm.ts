import type { IWebDavPreset } from '@frozik/cloud-storage/webdav/webdav-presets';
import { presetEndpoint, webDavPresetOf } from '@frozik/cloud-storage/webdav/webdav-presets';
import type { TWebDavProbeFailure } from '@frozik/cloud-storage/webdav/webdav-probe';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TCloudLocation } from '../domain/cloud-files';
import type { IWebDavSecrets } from '../domain/ports/cloud';
import type { IWebDavReach, TProbeWebDav } from '../domain/ports/webdav-prober';
import type { TWebDavAddressProblem } from '../domain/webdav-address';
import { webDavAddressProblem } from '../domain/webdav-address';

export type TWebDavCheck =
  | { readonly kind: 'unchecked' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'reachable'; readonly reach: IWebDavReach }
  | { readonly kind: 'failed'; readonly failure: TWebDavProbeFailure };

const UNCHECKED: TWebDavCheck = { kind: 'unchecked' };

/**
 * The WebDAV folder, the
 * login and an app password, and "Check": the probe says what the server
 * honours, or why the page cannot reach it. Any edit makes the answer stale.
 */
export class WebDavConnectForm {
  /** A known service whose folder the login (and one's own server) fill in; `null` for an address typed by hand. */
  preset: IWebDavPreset | null = null;
  server = '';
  typedEndpoint = '';
  username = '';
  password = '';
  check: TWebDavCheck = UNCHECKED;

  private controller: AbortController | null = null;

  constructor(private readonly probe: TProbeWebDav) {
    makeAutoObservable<WebDavConnectForm, 'probe' | 'controller'>(
      this,
      { check: observableRef, preset: observableRef, probe: false, controller: false },
      { autoBind: true }
    );
  }

  get endpoint(): string {
    return isNil(this.preset)
      ? this.typedEndpoint
      : presetEndpoint(this.preset, { username: this.username, server: this.server });
  }

  get addressProblem(): TWebDavAddressProblem | null {
    return webDavAddressProblem(this.endpoint);
  }

  get canCheck(): boolean {
    return isNil(this.addressProblem) && this.username.trim() !== '' && this.password !== '';
  }

  setEndpoint(endpoint: string): void {
    this.preset = null;
    this.typedEndpoint = endpoint;
    this.uncheck();
  }

  /** A service from the list, or `null` to type the address; the address shown so far stays to edit. */
  setPreset(id: string | null): void {
    const preset = isNil(id) ? undefined : webDavPresetOf(id);
    this.typedEndpoint = this.endpoint;
    this.preset = preset ?? null;
    this.uncheck();
  }

  setServer(server: string): void {
    this.server = server;
    this.uncheck();
  }

  setUsername(username: string): void {
    this.username = username;
    this.uncheck();
  }

  setPassword(password: string): void {
    this.password = password;
    this.uncheck();
  }

  async runCheck(): Promise<void> {
    if (!this.canCheck) {
      return;
    }
    this.uncheck();
    const controller = new AbortController();
    this.controller = controller;
    this.check = { kind: 'checking' };
    const result = await this.probe(
      { endpoint: this.endpoint.trim(), username: this.username.trim(), password: this.password },
      controller.signal
    );
    if (controller.signal.aborted) {
      return;
    }
    runInAction(() => {
      this.check = result.ok
        ? { kind: 'reachable', reach: result.value }
        : { kind: 'failed', failure: result.error };
    });
  }

  /** Where the vault's file goes in the checked folder, and what the device must keep to reach it. */
  linkFor(
    fileName: string
  ): { readonly location: TCloudLocation; readonly secrets: IWebDavSecrets } | null {
    if (this.check.kind !== 'reachable') {
      return null;
    }
    return {
      location: {
        kind: 'webdav',
        url: this.endpoint.trim(),
        username: this.username.trim(),
        path: fileName,
      },
      secrets: { password: this.password, features: this.check.reach.features },
    };
  }

  dispose(): void {
    this.uncheck();
    this.password = '';
  }

  /** Back to the settings: the folder is to be checked again. */
  uncheck(): void {
    this.controller?.abort();
    this.controller = null;
    this.check = UNCHECKED;
  }
}
