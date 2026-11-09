import { makeObservable, observableRef, runInAction } from 'mobx';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { TE164Digits } from '../domain/caller';
import type { INumberingMask } from '../domain/numbering/gen/numbering-codes';
import type { INumberingDetails } from '../domain/numbering/numbering-details';
import { numberingDetailsOf } from '../domain/numbering/numbering-details';
import { numberingPathOf } from '../domain/numbering/numbering-lookup';
import type { TLoadNumberingCatalogue } from '../domain/ports/numbering-catalogue';

/** Where numbers are from and whose network, once the catalogue has loaded; nothing before. */
export class NumberingCatalogue {
  roots: readonly INumberingMask[] | null = null;

  constructor(
    private readonly load: TLoadNumberingCatalogue,
    private readonly diagnostics: IDiagnosticsLog
  ) {
    makeObservable(this, { roots: observableRef });
  }

  async open(): Promise<void> {
    try {
      const roots = await this.load();
      runInAction(() => {
        this.roots = roots;
      });
    } catch (error: unknown) {
      this.diagnostics.log('error', 'app', 'numbering-catalogue-failed', { error: String(error) });
    }
  }

  detailsOf(digits: TE164Digits): INumberingDetails | null {
    return this.roots === null ? null : numberingDetailsOf(numberingPathOf(this.roots, digits));
  }
}
