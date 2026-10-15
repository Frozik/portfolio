import { mergeDocument } from '@frozik/vault/merge/merge-document';
import { latestStampOf } from '@frozik/vault/model/document-stamp';
import type { IHlc } from '@frozik/vault/model/hlc';
import { hlcReceive, hlcTick } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { isEqual } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import type { TDocumentEdit } from './transact';

/** What a merge did: whether this copy changed, and whether it holds news the other copy lacks. */
export interface IMergeOutcome {
  readonly changed: boolean;
  readonly localHasNews: boolean;
}

/**
 * The open vault's document and the clock that stamps its edits: the one
 * owner of both. Every change is an edit stamped past the last one seen.
 */
export class SessionDocument {
  document: IVaultDocument;
  readOnly: boolean;
  private clock: IHlc;

  constructor(
    opened: {
      readonly document: IVaultDocument;
      readonly access: 'read-write' | 'read-only';
      readonly clock: IHlc;
    },
    private readonly hooks: {
      readonly now: () => number;
      /** An edit changed the document. */
      readonly onEdited: () => void;
    }
  ) {
    this.document = opened.document;
    this.readOnly = opened.access === 'read-only';
    this.clock = opened.clock;
    makeAutoObservable<SessionDocument, 'clock' | 'hooks'>(
      this,
      { document: observableRef, clock: false, hooks: false },
      { autoBind: true }
    );
  }

  /** The last stamp issued or seen. */
  get stamp(): IHlc {
    return this.clock;
  }

  /** A newer schema came in: writing would drop what this build cannot see. */
  makeReadOnly(): void {
    this.readOnly = true;
  }

  transact<T>(edit: TDocumentEdit<T>): T | null {
    if (this.readOnly) {
      return null;
    }
    this.clock = hlcTick(this.clock, this.hooks.now());
    const { document, result } = edit(this.document, this.clock);
    if (document !== this.document) {
      this.document = document;
      this.hooks.onEdited();
    }
    return result;
  }

  /** Another copy's document joins this one; the clock moves past everything it brought. */
  merge(remote: IVaultDocument): IMergeOutcome {
    const before = this.document;
    this.document = mergeDocument(this.document, remote);
    this.clock = hlcReceive(this.clock, latestStampOf(this.document), this.hooks.now()).clock;
    return {
      changed: this.document !== before && !isEqual(this.document, before),
      localHasNews: !isEqual(this.document, mergeDocument(remote, remote)),
    };
  }
}
