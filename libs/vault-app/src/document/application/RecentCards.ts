import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCardId } from '@frozik/vault/model/ids';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { DEVICE_USAGE_LABEL } from '@frozik/vault/session/device-record-labels';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';
import { z } from 'zod';

/** As many as a strip shows at once. */
const RECENT_LIMIT = 8;
const RECENT_RECORD = 'recent-cards';

const RECENT_SCHEMA = z.array(z.string().transform(id => id as TCardId)).max(RECENT_LIMIT);

function decodeRecent(value: unknown): readonly TCardId[] | null {
  const parsed = RECENT_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The cards opened lately on this device, newest first: kept sealed under
 * the vault's key in the device store, never in the vault file, so another
 * device's habits do not show here.
 */
export class RecentCards {
  ids: readonly TCardId[] = [];

  private saving: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly record: ISealedJsonRecord<readonly TCardId[]>,
    private readonly document: () => IVaultDocument
  ) {
    makeAutoObservable<RecentCards, 'record' | 'document' | 'saving'>(
      this,
      { ids: observableRef, record: false, document: false, saving: false },
      { autoBind: true }
    );
  }

  /** The cards still there and in sight: an archived or trashed one drops out of the strip. */
  get cards(): readonly IVaultCard[] {
    const { cards } = this.document();
    return this.ids.flatMap(id => {
      const card = cards.get(id);
      return isNil(card) || !isNil(card.archivedAt) || !isNil(card.trashedAt) ? [] : [card];
    });
  }

  async load(): Promise<void> {
    const stored = await this.record.load();
    runInAction(() => {
      if (!isNil(stored) && this.ids.length === 0) {
        this.ids = stored;
      }
    });
  }

  opened(cardId: TCardId): void {
    this.ids = [cardId, ...this.ids.filter(id => id !== cardId)].slice(0, RECENT_LIMIT);
    this.saving = this.record.save(this.ids);
  }

  /** The last change is sealed: a key rotation re-seals what is stored. */
  saved(): Promise<unknown> {
    return this.saving;
  }
}

export function createRecentCards({
  store,
  vaultKey,
  dek,
  random,
  document,
}: {
  readonly store: ISealedRecordStore;
  readonly vaultKey: TVaultKey;
  readonly dek: CryptoKey;
  readonly random: IRandom;
  readonly document: () => IVaultDocument;
}): RecentCards {
  return new RecentCards(
    createSealedJsonRecord({
      store,
      vaultKey,
      recordKey: RECENT_RECORD,
      dek,
      label: DEVICE_USAGE_LABEL,
      random,
      decode: decodeRecent,
    }),
    document
  );
}
