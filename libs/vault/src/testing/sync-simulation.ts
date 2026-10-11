import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err } from '@frozik/utils/result/result';
import { isEqual } from 'lodash-es';

import { createInThreadCodec } from '../codec/in-thread-codec';
import type { IVaultCodec } from '../codec/vault-codec';
import { toHex } from '../crypto/bytes';
import type { TManifest } from '../format/manifest';
import type { IVaultKeys } from '../format/vault-keys';
import { mergeDocument } from '../merge/merge-document';
import { latestStampOf } from '../model/document-stamp';
import type { IHlc } from '../model/hlc';
import { hlcTick, maxHlc } from '../model/hlc';
import type { IVaultDocument } from '../model/vault-document';
import type { IRandom } from '../ports/random';
import type { ISyncReplica } from '../session/sync-effect-runner';
import { runSyncEffect } from '../session/sync-effect-runner';
import type { TSyncEffect } from '../sync/sync-effects';
import type { TSyncEvent } from '../sync/sync-events';
import type { ISyncState } from '../sync/sync-state';
import { initialSyncState } from '../sync/sync-state';
import { syncStep } from '../sync/sync-step';

export type TTarget = 'local' | 'cloud';

export interface ISimTab {
  readonly name: string;
  readonly device: ISimDevice;
  document: IVaultDocument;
  clock: IHlc;
  readonly engines: Map<TTarget, ISyncState>;
}

export interface ISimDevice {
  readonly name: string;
  readonly local: IStorageProvider;
  readonly tabs: ISimTab[];
  offline: boolean;
}

interface IPendingEffect {
  readonly tab: ISimTab;
  readonly target: TTarget;
  readonly effect: TSyncEffect;
}

const FILE = storagePath('vault.pwv');
const SIGNAL = new AbortController().signal;

/**
 * The shell of every engine of every tab, and the scheduler:
 * it runs pending effects in an order picked from the seed, so a failing
 * interleaving replays exactly.
 */
export class SyncSimulation {
  readonly devices: ISimDevice[] = [];
  private readonly pending: IPendingEffect[] = [];
  private readonly codec: IVaultCodec;

  constructor(
    private readonly cloud: IStorageProvider,
    private readonly keys: IVaultKeys,
    private readonly manifest: TManifest,
    private readonly random: IRandom,
    dependencies: Parameters<typeof createInThreadCodec>[0]
  ) {
    this.codec = createInThreadCodec(dependencies);
  }

  addDevice(name: string, tabCount: number, document: IVaultDocument): ISimDevice {
    const device: ISimDevice = { name, local: createMemoryProvider(), tabs: [], offline: false };
    const guard = {
      vaultId: toHex(this.keys.vaultId),
      keyId: toHex(this.keys.keyId),
      maxSeenRevision: 0,
      maxSeenKeyslotsEpoch: this.keys.keyslotsEpoch,
      hashAtMaxSeen: null,
      retiredKeyIds: [],
    };
    for (let index = 0; index < tabCount; index += 1) {
      const engines = new Map<TTarget, ISyncState>([['local', initialSyncState(guard, null)]]);
      if (index === 0) {
        engines.set('cloud', initialSyncState(guard, null));
      }
      device.tabs.push({
        name: `${name}:tab-${index}`,
        device,
        document,
        clock: { wallMs: 0, counter: 0, node: `${name}:tab-${index}` },
        engines,
      });
    }
    this.devices.push(device);
    return device;
  }

  get tabs(): readonly ISimTab[] {
    return this.devices.flatMap(device => device.tabs);
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** What a replica holds on disk, opened: the cloud file, or a device's local copy. */
  async storedDocument(provider: IStorageProvider | 'cloud'): Promise<IVaultDocument | null> {
    const read = await (provider === 'cloud' ? this.cloud : provider).read(FILE, SIGNAL);
    if (!read.ok || read.value === null) {
      return null;
    }
    const opened = await this.codec.open(
      read.value.bytes,
      { kind: 'session', dek: this.keys.dek, keyId: this.keys.keyId },
      SIGNAL
    );
    return opened.ok ? opened.value.document : null;
  }

  /** A user edit in a tab: applied at once in memory, then pushed to the local copy. */
  edit(
    tab: ISimTab,
    wallMs: number,
    change: (document: IVaultDocument, at: IHlc) => IVaultDocument
  ): void {
    tab.clock = hlcTick(tab.clock, wallMs);
    tab.document = change(tab.document, tab.clock);
    this.dispatch(tab, 'local', { kind: 'push-requested' });
  }

  dispatch(tab: ISimTab, target: TTarget, event: TSyncEvent): void {
    const state = tab.engines.get(target);
    if (state === undefined) {
      return;
    }
    const next = syncStep(state, event);
    tab.engines.set(target, next.state);
    next.effects.forEach(effect => this.pending.push({ tab, target, effect }));
  }

  /** Runs one pending effect chosen by the seed. */
  async runOne(): Promise<boolean> {
    if (this.pending.length === 0) {
      return false;
    }
    const index = (this.random.bytes(1)[0] ?? 0) % this.pending.length;
    const [chosen] = this.pending.splice(index, 1);
    assert(chosen !== undefined);
    await this.execute(chosen);
    return true;
  }

  async runAll(limit: number): Promise<void> {
    let steps = 0;
    while (steps < limit && (await this.runOne())) {
      steps += 1;
    }
  }

  private provider(tab: ISimTab, target: TTarget): IStorageProvider {
    if (target === 'local') {
      return tab.device.local;
    }
    return tab.device.offline ? offlineProvider(this.cloud) : this.cloud;
  }

  private async execute({ tab, target, effect }: IPendingEffect): Promise<void> {
    const event = await runSyncEffect(effect, this.replica(tab, target), SIGNAL);
    if (event === null) {
      return;
    }
    this.dispatch(tab, target, event);
    if (
      target === 'local' &&
      event.kind === 'write-done' &&
      event.result.ok &&
      event.result.value.kind === 'ok'
    ) {
      tab.device.tabs
        .filter(other => other !== tab)
        .forEach(other => this.dispatch(other, 'local', { kind: 'pull-requested' }));
    }
  }

  private replica(tab: ISimTab, target: TTarget): ISyncReplica {
    return {
      provider: this.provider(tab, target),
      path: FILE,
      codec: this.codec,
      random: this.random,
      keys: this.keys,
      manifest: this.manifest,
      document: () => tab.document,
      merge: remote => this.merge(tab, target, remote),
      saveGuard: () => Promise.resolve(),
      adoptKeys: () => undefined,
      keysShared: () => undefined,
      wait: () => Promise.resolve(true),
    };
  }

  /** The shell's part of a merge: into the tab's document as it is now; news for the other replica is pushed to it. */
  private merge(tab: ISimTab, target: TTarget, remote: IVaultDocument): boolean {
    const before = tab.document;
    tab.document = mergeDocument(before, remote);
    tab.clock = maxHlc(tab.clock, { ...latestStampOf(tab.document), node: tab.clock.node });
    const other: TTarget = target === 'local' ? 'cloud' : 'local';
    if (!isEqual(before, tab.document)) {
      this.dispatch(tab, other, { kind: 'push-requested' });
    }
    return !isEqual(tab.document, mergeDocument(remote, remote));
  }
}

function offline<T>(): Promise<TStorageResult<T>> {
  return Promise.resolve(err({ kind: 'offline' }));
}

function offlineProvider(cloud: IStorageProvider): IStorageProvider {
  return { ...cloud, stat: offline, read: offline, write: offline, remove: offline, list: offline };
}

/**
 * A provider without a real compare-and-swap, like Drive: now
 * and then a write lands although someone wrote in between. Correctness must
 * come from the mergeable format, not from the provider.
 */
export function createRacyProvider(random: IRandom, raceEvery: number): IStorageProvider {
  const inner = createMemoryProvider({ now: () => 0 as Milliseconds });
  return {
    ...inner,
    capabilities: { ...inner.capabilities, conditionalWrite: 'check-then-write' },
    write: (path, bytes, precondition, signal) => {
      const race = precondition.kind === 'match' && (random.bytes(1)[0] ?? 0) % raceEvery === 0;
      return inner.write(path, bytes, race ? { kind: 'overwrite' } : precondition, signal);
    },
  };
}
