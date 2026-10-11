import type { IAuditReport } from '@frozik/vault/audit/audit-report';
import { auditVault } from '@frozik/vault/audit/audit-report';
import { auditedPasswords } from '@frozik/vault/audit/audited-passwords';
import type { TCardId } from '@frozik/vault/model/ids';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import {
  computedStruct,
  makeAutoObservable,
  observable,
  observableRef,
  reaction,
  runInAction,
} from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { IBreachCheck, TLoadTwoFactorDirectory } from '../domain/ports/audit-sources';
import type { ISessionClock } from '../domain/ports/session-clock';
import type { IStrengthMeter } from '../domain/ports/strength-meter';

/** Answers applied together: each batch re-audits the vault once. */
const ANSWERS_PER_BATCH = 50;

export interface IVaultAuditServices {
  readonly document: () => IVaultDocument;
  /** The breach check is this device's choice, off until the user turns it on. */
  readonly checkLeaks: () => boolean;
  readonly meter: IStrengthMeter;
  readonly breaches: IBreachCheck;
  readonly loadTwoFactorDirectory: TLoadTwoFactorDirectory;
  readonly clock: ISessionClock;
  /** The day the vault's view counts with, observable: "expiring" turns "expired" at midnight. */
  readonly today: () => Temporal.PlainDate;
}

/**
 * The audit of the open vault. The report is a pure
 * function of the document and what is known so far; the strength of each
 * password is estimated in the Worker, breaches are looked up only when the
 * user allowed it, and the 2FA list loads once — each fills in as it comes.
 */
export class VaultAudit {
  twoFactorDomains: ReadonlySet<string> | null = null;
  /** The 2FA list was asked for and answered, with the list or with nothing. */
  directoryLoaded = false;

  private readonly scores = observable.map<string, number>();
  private readonly breachCounts = observable.map<string, number>();
  /** Passwords asked about right now: a document change meanwhile must not ask again. */
  private readonly asking = new Set<string>();
  private readonly controller = new AbortController();
  private readonly stopFollowing: () => void;

  constructor(private readonly services: IVaultAuditServices) {
    makeAutoObservable<
      VaultAudit,
      'services' | 'scores' | 'breachCounts' | 'asking' | 'controller' | 'stopFollowing'
    >(
      this,
      {
        twoFactorDomains: observableRef,
        problems: computedStruct,
        services: false,
        scores: false,
        breachCounts: false,
        asking: false,
        controller: false,
        stopFollowing: false,
      },
      { autoBind: true }
    );
    const stopEstimating = reaction(
      () => auditedPasswords(services.document()),
      passwords => void this.estimate(passwords),
      { fireImmediately: true }
    );
    const stopChecking = reaction(
      () => (services.checkLeaks() ? auditedPasswords(services.document()) : []),
      passwords => void this.checkBreaches(passwords),
      { fireImmediately: true }
    );
    this.stopFollowing = () => {
      stopEstimating();
      stopChecking();
    };
    void this.loadDirectory();
  }

  get report(): IAuditReport {
    const { services } = this;
    const leaksChecked = services.checkLeaks();
    return auditVault(services.document(), {
      now: Temporal.Instant.fromEpochMilliseconds(services.clock.now()),
      today: services.today(),
      strength: password => this.scores.get(password) ?? null,
      breaches: password => (leaksChecked ? (this.breachCounts.get(password) ?? null) : null),
      twoFactorDomains: this.twoFactorDomains,
    });
  }

  /** The members of "Problem passwords"; equal sets do not re-classify the vault. */
  get problems(): ReadonlySet<TCardId> {
    return new Set(this.report.byCard.keys());
  }

  dispose(): void {
    this.controller.abort();
    this.stopFollowing();
    this.services.meter.dispose();
  }

  private estimate(passwords: readonly string[]): Promise<void> {
    return this.ask(passwords, 'strength', this.scores, async (password, signal) => {
      const strength = await this.services.meter.estimate(password, [], signal);
      return strength?.score ?? null;
    });
  }

  private checkBreaches(passwords: readonly string[]): Promise<void> {
    return this.ask(passwords, 'breach', this.breachCounts, (password, signal) =>
      this.services.breaches.count(password, signal)
    );
  }

  /**
   * One question per password, never two at once for the same one; answers
   * land in batches, so a vault of thousands re-audits a few dozen times
   * while they arrive, not once per password.
   */
  private async ask(
    passwords: readonly string[],
    kind: string,
    answers: Map<string, number>,
    question: (password: string, signal: AbortSignal) => Promise<number | null>
  ): Promise<void> {
    const { signal } = this.controller;
    const batch = new Map<string, number>();
    const asked: string[] = [];
    const commit = (): void => {
      if (batch.size > 0) {
        runInAction(() => batch.forEach((value, password) => answers.set(password, value)));
        batch.clear();
      }
      asked.forEach(key => this.asking.delete(key));
      asked.length = 0;
    };
    for (const password of passwords) {
      const key = `${kind}:${password}`;
      if (signal.aborted) {
        return;
      }
      if (answers.has(password) || this.asking.has(key)) {
        continue;
      }
      this.asking.add(key);
      asked.push(key);
      const answer = await question(password, signal);
      if (!isNil(answer)) {
        batch.set(password, answer);
      }
      if (batch.size >= ANSWERS_PER_BATCH) {
        commit();
      }
    }
    commit();
  }

  private async loadDirectory(): Promise<void> {
    const domains = await this.services.loadTwoFactorDirectory(this.controller.signal);
    runInAction(() => {
      this.twoFactorDomains = domains;
      this.directoryLoaded = true;
    });
  }
}
