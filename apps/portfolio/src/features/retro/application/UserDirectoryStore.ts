import { makeAutoObservable, observable, runInAction } from 'mobx';

import type { ClientId } from '../domain/types';
import type { IUserDirectoryRepo, IUserProfile } from '../infrastructure/user-directory-repo';
import { nowIso } from '../infrastructure/user-directory-repo';

/**
 * In-memory, persistent cache of known users keyed by stable `clientId`.
 * All parts of the UI that display "whose retro / whose card is this"
 * look the owner id up in this directory — so a rename performed once
 * propagates everywhere automatically.
 */
export class UserDirectoryStore {
  /**
   * Observable map. Kept as a MobX observable map so component subscribers
   * can depend on individual `clientId` lookups without rerendering on
   * unrelated user updates.
   */
  profiles = observable.map<ClientId, IUserProfile>(new Map(), { deep: false });

  constructor(private readonly repoPromise: Promise<IUserDirectoryRepo>) {
    makeAutoObservable(this, { repoPromise: false, profiles: observable.ref } as never, {
      autoBind: true,
    });
    void this.hydrate();
  }

  private async hydrate(): Promise<void> {
    const repo = await this.repoPromise;
    const all = await repo.listAll();

    runInAction(() => {
      all.forEach(profile => {
        this.profiles.set(profile.clientId, profile);
      });
    });
  }

  get(clientId: ClientId): IUserProfile | null {
    return this.profiles.get(clientId) ?? null;
  }

  getName(clientId: ClientId): string {
    return this.profiles.get(clientId)?.name ?? '';
  }

  async upsert(input: {
    readonly clientId: ClientId;
    readonly name: string;
    readonly color: string;
  }): Promise<void> {
    const profile: IUserProfile = {
      clientId: input.clientId,
      name: input.name,
      color: input.color,
      lastSeenAt: nowIso(),
    };
    runInAction(() => {
      this.profiles.set(profile.clientId, profile);
    });
    const repo = await this.repoPromise;
    await repo.upsert(profile);
  }

  /**
   * Bootstrap-only: write the profile if we have no record of this
   * `clientId` yet. Used to seed the facilitator from `meta.facilitatorName`
   * when joining a room whose facilitator is offline — any later awareness
   * event will overwrite this with the live value.
   */
  async seedIfMissing(input: {
    readonly clientId: ClientId;
    readonly name: string;
    readonly color: string;
  }): Promise<void> {
    if (this.profiles.has(input.clientId)) {
      return;
    }
    await this.upsert(input);
  }

  dispose(): void {
    this.profiles.clear();
  }
}
