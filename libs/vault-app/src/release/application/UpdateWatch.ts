import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { IVersionSource } from '../domain/ports/version-source';
import type { TUpdateVerdict } from '../domain/update-verdict';
import { updateVerdict } from '../domain/update-verdict';
import type { TReleaseClient } from '../domain/version-manifest';

/** This build against the published releases; an unreadable answer (offline) changes nothing. */
export class UpdateWatch {
  verdict: TUpdateVerdict = 'current';

  constructor(
    private readonly source: IVersionSource,
    private readonly build: { readonly client: TReleaseClient; readonly version: string }
  ) {
    makeAutoObservable<UpdateWatch, 'source' | 'build'>(
      this,
      { source: false, build: false },
      { autoBind: true }
    );
  }

  async check(): Promise<void> {
    const manifest = await this.source.read();
    if (isNil(manifest)) {
      return;
    }
    runInAction(() => {
      this.verdict = updateVerdict(this.build.version, manifest[this.build.client]);
    });
  }
}
