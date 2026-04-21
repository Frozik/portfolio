import { makeAutoObservable } from 'mobx';

import type { ClientId } from '../domain/types';
import type { IIdentityRepo, IRetroIdentity } from '../infrastructure/identity-repo';
import type { UserDirectoryStore } from './UserDirectoryStore';

export class IdentityStore {
  identity: IRetroIdentity;

  constructor(
    private readonly repo: IIdentityRepo,
    private readonly directory: UserDirectoryStore
  ) {
    // Blank default: forces IdentityDialog on first visit so the user
    // picks a real display name before participating.
    this.identity = this.repo.getOrCreate('');
    makeAutoObservable(this, { repo: false, directory: false } as never, { autoBind: true });
    this.publishToDirectory();
  }

  get hasName(): boolean {
    return this.identity.name.trim().length > 0;
  }

  setName(name: string): void {
    this.identity = { ...this.identity, name };
    this.repo.save(this.identity);
    this.publishToDirectory();
  }

  setColor(color: string): void {
    this.identity = { ...this.identity, color };
    this.repo.save(this.identity);
    this.publishToDirectory();
  }

  private publishToDirectory(): void {
    void this.directory.upsert({
      clientId: this.identity.clientId as ClientId,
      name: this.identity.name,
      color: this.identity.color,
    });
  }

  dispose(): void {}
}
