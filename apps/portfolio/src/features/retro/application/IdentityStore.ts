import { makeAutoObservable, reaction } from 'mobx';

import type { AuthSession } from '../../../shared/communication/AuthSession';
import type { ClientId } from '../domain/types';
import type { IIdentityRepo, IRetroIdentity } from '../infrastructure/identity-repo';
import type { UserDirectoryStore } from './UserDirectoryStore';

const GUEST_DISPLAY_NAME = 'Guest';

/**
 * Holds the runtime identity used by the retro feature. The display
 * name and avatar are derived from the OIDC session (`AuthSession`) —
 * there is no in-app editing UI. Only the `clientId` is persisted (in
 * localStorage via {@link IIdentityRepo}) so awareness events stay
 * attributable to the same user across reloads.
 *
 * On every change to the OIDC profile (sign-in, profile refresh) the
 * derived identity is published to {@link UserDirectoryStore} so peers
 * and the local lobby see the latest name + avatar.
 */
export class IdentityStore {
  private readonly clientId: number;
  private readonly disposeProfileReaction: VoidFunction;

  constructor(
    private readonly repo: IIdentityRepo,
    private readonly directory: UserDirectoryStore,
    private readonly session: AuthSession
  ) {
    this.clientId = this.repo.getOrCreateClientId();
    makeAutoObservable<IdentityStore, 'repo' | 'directory' | 'session' | 'disposeProfileReaction'>(
      this,
      { repo: false, directory: false, session: false, disposeProfileReaction: false },
      { autoBind: true }
    );
    this.disposeProfileReaction = reaction(
      () => this.identity,
      identity => {
        void this.directory.upsert({
          clientId: identity.clientId as ClientId,
          name: identity.name,
          pictureUrl: identity.pictureUrl,
        });
      },
      { fireImmediately: true }
    );
  }

  get identity(): IRetroIdentity {
    return {
      clientId: this.clientId,
      name: this.name,
      pictureUrl: this.pictureUrl,
    };
  }

  get name(): string {
    const raw = this.session.profile?.name?.trim();
    return raw !== undefined && raw.length > 0 ? raw : GUEST_DISPLAY_NAME;
  }

  get pictureUrl(): string | undefined {
    return this.session.profile?.pictureUrl ?? undefined;
  }

  dispose(): void {
    this.disposeProfileReaction();
  }
}
