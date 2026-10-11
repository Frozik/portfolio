import { isNil } from 'lodash-es';

import type { IVaultCard } from '../model/card';
import type { IHlc } from '../model/hlc';
import { compareHlc, maxHlc } from '../model/hlc';
import type { TCardId } from '../model/ids';
import type { TSiteIcon } from '../model/site-icon';
import type {
  IAsset,
  ICardLink,
  IUserGroup,
  IUserSmartGroup,
  IUserTemplate,
  IVaultDocument,
  IVaultSettings,
  TTombstoneKey,
} from '../model/vault-document';
import { mergeCard } from './merge-card';
import { compareBytes, compareVersions, mergeMaps } from './merge-order';

type TTombstones = ReadonlyMap<TTombstoneKey, IHlc>;

function isNewerThanTombstone(stamp: IHlc, tombstone: IHlc | undefined): boolean {
  return isNil(tombstone) || compareHlc(stamp, tombstone) > 0;
}

function either<Value>(
  local: Value | undefined,
  remote: Value | undefined,
  merge: (local: Value, remote: Value) => Value
): Value | undefined {
  if (isNil(local)) {
    return remote;
  }
  return isNil(remote) ? local : merge(local, remote);
}

function laterVersion<Value>(
  stampOf: (value: Value) => IHlc
): (local: Value, remote: Value) => Value {
  return (local, remote) =>
    compareVersions(local, remote, stampOf, value => value) >= 0 ? local : remote;
}

function mergeTombstones(local: TTombstones, remote: TTombstones): TTombstones {
  return mergeMaps(local, remote, (_key, localStamp, remoteStamp) =>
    either(localStamp, remoteStamp, maxHlc)
  );
}

/**
 * A card newer than its tombstone lives (an edit outlives a
 * deletion it did not see). A version not newer than the tombstone brings
 * nothing — no win, no history, no HOTP counter — and the versions from
 * before the deletion leave the history: a deleted card's old secrets do not
 * survive anywhere. Tombstones only grow, so this holds in any merge order.
 */
function mergeCards(
  local: IVaultDocument,
  remote: IVaultDocument,
  tombstones: TTombstones
): ReadonlyMap<TCardId, IVaultCard> {
  return mergeMaps(local.cards, remote.cards, (id, localCard, remoteCard) => {
    const tombstone = tombstones.get(`card:${id}`);
    const outlives = (card: IVaultCard | undefined): IVaultCard | undefined => {
      if (isNil(card) || !isNewerThanTombstone(card.updatedAt, tombstone)) {
        return undefined;
      }
      return isNil(tombstone)
        ? card
        : {
            ...card,
            history: card.history.filter(revision => isNewerThanTombstone(revision.at, tombstone)),
          };
    };
    return either(outlives(localCard), outlives(remoteCard), mergeCard);
  });
}

/** Links stay in the map once seen; whether one is alive is decided on read (`isLinkAlive`). */
function mergeLinks(local: IVaultDocument, remote: IVaultDocument): IVaultDocument['links'] {
  return mergeMaps(local.links, remote.links, (_id, localLink, remoteLink) =>
    either(
      localLink,
      remoteLink,
      laterVersion((link: ICardLink) => link.createdAt)
    )
  );
}

function mergeGroups(
  local: IVaultDocument,
  remote: IVaultDocument,
  tombstones: TTombstones
): IVaultDocument['groups'] {
  return mergeMaps(local.groups, remote.groups, (id, localGroup, remoteGroup) => {
    const group = either(
      localGroup,
      remoteGroup,
      laterVersion((value: IUserGroup) => value.updatedAt)
    );
    return !isNil(group) && isNewerThanTombstone(group.updatedAt, tombstones.get(`group:${id}`))
      ? group
      : undefined;
  });
}

function mergeTemplates(
  local: IVaultDocument,
  remote: IVaultDocument,
  tombstones: TTombstones
): IVaultDocument['templates'] {
  return mergeMaps(local.templates, remote.templates, (id, localTemplate, remoteTemplate) => {
    const template = either(
      localTemplate,
      remoteTemplate,
      laterVersion((value: IUserTemplate) => value.updatedAt)
    );
    return !isNil(template) &&
      isNewerThanTombstone(template.updatedAt, tombstones.get(`template:${id}`))
      ? template
      : undefined;
  });
}

function mergeSmartGroups(
  local: IVaultDocument,
  remote: IVaultDocument,
  tombstones: TTombstones
): IVaultDocument['smartGroups'] {
  return mergeMaps(local.smartGroups, remote.smartGroups, (id, localGroup, remoteGroup) => {
    const group = either(
      localGroup,
      remoteGroup,
      laterVersion((value: IUserSmartGroup) => value.updatedAt)
    );
    return !isNil(group) && isNewerThanTombstone(group.updatedAt, tombstones.get(`group:${id}`))
      ? group
      : undefined;
  });
}

/**
 * Assets are immutable, so the union; `orphanedAt` takes the
 * later stamp and is never cleared by merge: garbage collection checks the
 * references again before it deletes anything.
 */
function mergeAssets(local: IVaultDocument, remote: IVaultDocument): IVaultDocument['assets'] {
  return mergeMaps(local.assets, remote.assets, (_id, localAsset, remoteAsset) =>
    either(localAsset, remoteAsset, (first: IAsset, second: IAsset): IAsset => {
      const orphanedAt =
        isNil(first.orphanedAt) || isNil(second.orphanedAt)
          ? (first.orphanedAt ?? second.orphanedAt)
          : maxHlc(first.orphanedAt, second.orphanedAt);
      return {
        ...(compareVersions(
          first,
          second,
          asset => asset.createdAt,
          asset => asset
        ) >= 0
          ? first
          : second),
        orphanedAt,
      };
    })
  );
}

function mergeBytes<Key>(
  local: ReadonlyMap<Key, Uint8Array<ArrayBuffer>>,
  remote: ReadonlyMap<Key, Uint8Array<ArrayBuffer>>
): ReadonlyMap<Key, Uint8Array<ArrayBuffer>> {
  return mergeMaps(local, remote, (_key, localBytes, remoteBytes) =>
    either(localBytes, remoteBytes, (first, second) =>
      compareBytes(first, second) >= 0 ? first : second
    )
  );
}

/**
 * `merge(local, remote)`: a pure function, commutative,
 * associative and idempotent, so devices that saw the same edits in any order
 * hold the same document. Stamps are compared, never rewritten.
 */
export function mergeDocument(local: IVaultDocument, remote: IVaultDocument): IVaultDocument {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const settingsFromLocal =
    compareVersions(
      local.settings,
      remote.settings,
      (settings: IVaultSettings) => settings.updatedAt,
      settings => settings
    ) >= 0;
  const cards = mergeCards(local, remote, tombstones);
  return {
    settings: settingsFromLocal ? local.settings : remote.settings,
    cards,
    groups: mergeGroups(local, remote, tombstones),
    templates: mergeTemplates(local, remote, tombstones),
    smartGroups: mergeSmartGroups(local, remote, tombstones),
    links: mergeLinks(local, remote),
    tombstones,
    assets: mergeAssets(local, remote),
    assetBytes: mergeBytes(local.assetBytes, remote.assetBytes),
    siteIcons: mergeMaps(local.siteIcons, remote.siteIcons, (_domain, localIcon, remoteIcon) =>
      either(
        localIcon,
        remoteIcon,
        laterVersion((icon: TSiteIcon) => icon.at)
      )
    ),
    hotpCounters: mergeMaps(
      local.hotpCounters,
      remote.hotpCounters,
      (_key, localCounter, remoteCounter) => either(localCounter, remoteCounter, Math.max)
    ),
  };
}
