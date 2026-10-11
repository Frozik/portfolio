import { assert } from '@frozik/utils/assert/assert';
import { isNil, uniq } from 'lodash-es';

import { addAsset, addBlobAsset, assetRefusal } from '../model/asset-edits';
import type { ICardField, ICardState, ICardTab, IVaultCard } from '../model/card';
import { allFields } from '../model/card';
import type { TTranslate } from '../model/card-edits';
import { editCard, putCard } from '../model/card-edits';
import { duplicateKeyOf } from '../model/duplicate-key';
import { normalizeCardValues } from '../model/field-edits';
import { createGroup } from '../model/group-edits';
import type { IHlc } from '../model/hlc';
import { hotpCounterKey } from '../model/hotp-counters';
import type { TAssetId, TCardId, TGroupId } from '../model/ids';
import { newCardId, newFieldId, newTabId } from '../model/ids';
import { linkCards } from '../model/link-edits';
import type { IVaultDocument } from '../model/vault-document';
import type { IRandom } from '../ports/random';
import type { IPlacedBlob } from './blob-placement';
import type {
  IImportBatch,
  IImportedAsset,
  IImportedCard,
  IImportedField,
  IImportedTab,
  TImportLabel,
} from './imported-card';

/** What happens to an entry this vault already has (same site and login). */
export type TDuplicatePolicy = 'skip' | 'replace' | 'keep-both';

export interface IImportContext {
  readonly translate: TTranslate;
  readonly random: IRandom;
  readonly duplicates: TDuplicatePolicy;
  /** Source files already sealed beside the vault (`blobsToPlace`), by their source id. */
  readonly blobs?: ReadonlyMap<TAssetId, IPlacedBlob>;
}

export interface IImportOutcome {
  readonly added: number;
  readonly replaced: number;
  readonly skipped: number;
  /** Files that did not fit the vault's limit: their fields come in empty. */
  readonly filesDropped: number;
}

interface IImportRun {
  document: IVaultDocument;
  readonly context: IImportContext;
  readonly at: IHlc;
  readonly groupIds: Map<string, TGroupId>;
  readonly sourceAssets: ReadonlyMap<TAssetId, IImportedAsset>;
  /** Source file ids already given a place in this vault, or `null` for one that did not fit. */
  readonly assetIds: Map<TAssetId, TAssetId | null>;
}

function labelText(label: TImportLabel, translate: TTranslate): string {
  return label.kind === 'key' ? translate(label.key) : label.text;
}

function groupKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * A file comes in when the first card that keeps it does: sealed beside the
 * vault when the import placed it so, inline when it fits, else not at all.
 */
function assetIdOf(run: IImportRun, sourceId: TAssetId): TAssetId | null {
  if (run.assetIds.has(sourceId)) {
    return run.assetIds.get(sourceId) ?? null;
  }
  const source = run.sourceAssets.get(sourceId);
  const blob = run.context.blobs?.get(sourceId);
  if (!isNil(source) && !isNil(blob)) {
    const { name, mime, sha256 } = source.asset;
    run.document = addBlobAsset(run.document, { name, mime, sha256, ...blob }, run.at);
    run.assetIds.set(sourceId, blob.id);
    return blob.id;
  }
  if (isNil(source) || !isNil(assetRefusal(run.document, source.bytes.byteLength))) {
    run.assetIds.set(sourceId, null);
    return null;
  }
  const { asset, bytes } = source;
  const added = addAsset(
    run.document,
    { name: asset.name, mime: asset.mime, sha256: asset.sha256, bytes },
    run.at,
    run.context.random
  );
  run.document = added.document;
  run.assetIds.set(sourceId, added.assetId);
  return added.assetId;
}

function groupIdOf(run: IImportRun, name: string): TGroupId {
  const key = groupKey(name);
  const known = run.groupIds.get(key);
  if (!isNil(known)) {
    return known;
  }
  const created = createGroup(run.document, name.trim(), run.at, run.context.random);
  run.document = created.document;
  run.groupIds.set(key, created.groupId);
  return created.groupId;
}

/** A template's select keeps translation keys; the card gets the words, as a card made here does. */
function translatedChoice(
  field: IImportedField,
  translate: TTranslate
): Pick<ICardField, 'spec' | 'value'> {
  const { spec, value } = field;
  if (spec.kind !== 'select' || value.cardinality !== 'single') {
    return { spec, value };
  }
  const chosen = spec.options.includes(value.value) ? translate(value.value) : value.value;
  return {
    spec: { ...spec, options: spec.options.map(translate) },
    value: { cardinality: 'single', value: chosen },
  };
}

function fieldOf(run: IImportRun, field: IImportedField): ICardField {
  return {
    id: newFieldId(run.context.random),
    label: labelText(field.label, run.context.translate),
    ...translatedChoice(field, run.context.translate),
    sensitive: field.sensitive,
    excludeFromAudit: false,
  };
}

/** The card as the source describes it, its files still under the source's ids and in no group yet. */
function stateOf(run: IImportRun, imported: IImportedCard): ICardState {
  const { at, context } = run;
  const toTab = (tab: IImportedTab): ICardTab => ({
    id: newTabId(context.random),
    title: isNil(tab.title) ? null : labelText(tab.title, context.translate),
    fields: tab.fields.map(field => fieldOf(run, field)),
  });
  const [firstTab, ...otherTabs] = imported.tabs;
  const createdAtMs = imported.createdAtMs ?? at.wallMs;
  return normalizeCardValues({
    id: newCardId(context.random),
    title: imported.title,
    templateId: imported.templateId,
    tabs: [toTab(firstTab), ...otherTabs.map(toTab)],
    groupIds: [],
    favorite: imported.favorite,
    color: imported.color,
    icon: imported.icon,
    protected: imported.protected,
    archivedAt: imported.archived ? at : null,
    trashedAt: null,
    createdAt: createdAtMs < at.wallMs ? { ...at, wallMs: createdAtMs, counter: 0 } : at,
    updatedAt: at,
    ancestors: [],
  });
}

function withFilesOf(run: IImportRun, field: ICardField): ICardField {
  if (field.spec.kind !== 'file') {
    return field;
  }
  const ids = (entry: string): string[] => {
    const id = entry === '' ? null : assetIdOf(run, entry as TAssetId);
    return isNil(id) ? [] : [id];
  };
  const { value } = field;
  return {
    ...field,
    value:
      value.cardinality === 'single'
        ? { cardinality: 'single', value: ids(value.value)[0] ?? '' }
        : { cardinality: 'list', values: value.values.flatMap(ids) },
  };
}

/** A card that is coming in takes its place: its files and groups become this vault's. */
function settled(run: IImportRun, state: ICardState, imported: IImportedCard): ICardState {
  const iconId = state.icon.kind === 'custom' ? assetIdOf(run, state.icon.assetId) : null;
  const [firstTab, ...otherTabs] = state.tabs.map(tab => ({
    ...tab,
    fields: tab.fields.map(field => withFilesOf(run, field)),
  }));
  assert(!isNil(firstTab), 'a card has a tab');
  return {
    ...state,
    tabs: [firstTab, ...otherTabs],
    icon:
      state.icon.kind !== 'custom'
        ? state.icon
        : isNil(iconId)
          ? { kind: 'auto' }
          : { kind: 'custom', assetId: iconId },
    groupIds: uniq(imported.groups.map(name => groupIdOf(run, name))),
  };
}

/** "replace" takes the source's content; what the source does not say keeps the card's own. */
function replacing(current: ICardState, incoming: ICardState): ICardState {
  return {
    ...incoming,
    id: current.id,
    groupIds: uniq([...current.groupIds, ...incoming.groupIds]),
    favorite: current.favorite || incoming.favorite,
    protected: current.protected || incoming.protected,
    color: incoming.color ?? current.color,
    icon: incoming.icon.kind === 'auto' ? current.icon : incoming.icon,
    archivedAt: current.archivedAt,
    createdAt: current.createdAt,
  };
}

/** A HOTP field keeps counting from where its old vault left it. */
function withHotpCounters(
  document: IVaultDocument,
  card: ICardState,
  imported: IImportedCard
): IVaultDocument {
  const counters = new Map(document.hotpCounters);
  allFields(card).forEach((field, index) => {
    const counter = imported.tabs.flatMap(tab => tab.fields)[index]?.hotpCounter;
    if (!isNil(counter)) {
      counters.set(hotpCounterKey(card.id, field.id), counter);
    }
  });
  return counters.size === document.hotpCounters.size
    ? document
    : { ...document, hotpCounters: counters };
}

function existingByKey(document: IVaultDocument): Map<string, TCardId> {
  const byKey = new Map<string, TCardId>();
  for (const card of document.cards.values()) {
    const key = isNil(card.trashedAt) ? duplicateKeyOf(allFields(card)) : null;
    if (!isNil(key) && !byKey.has(key)) {
      byKey.set(key, card.id);
    }
  }
  return byKey;
}

/**
 * The confirmed import, as one edit of the document: every
 * entry becomes a card of this vault with new ids, groups are found or made
 * by name, and an entry the vault already has is skipped, replaces the card
 * (its old version goes to history) or comes in beside it.
 */
export function applyImport(
  document: IVaultDocument,
  batch: IImportBatch,
  context: IImportContext,
  at: IHlc
): { readonly document: IVaultDocument; readonly result: IImportOutcome } {
  const run: IImportRun = {
    document,
    context,
    at,
    groupIds: new Map([...document.groups.values()].map(group => [groupKey(group.name), group.id])),
    sourceAssets: new Map(batch.assets.map(source => [source.asset.id, source])),
    assetIds: new Map(),
  };
  const byKey = existingByKey(run.document);
  const cardIds: TCardId[] = [];
  const outcome = { added: 0, replaced: 0, skipped: 0 };

  for (const imported of batch.cards) {
    const state = stateOf(run, imported);
    const key = duplicateKeyOf(allFields(state));
    const twin = isNil(key) || context.duplicates === 'keep-both' ? undefined : byKey.get(key);
    if (!isNil(twin) && context.duplicates === 'skip') {
      outcome.skipped += 1;
      cardIds.push(twin);
      continue;
    }
    const incoming = settled(run, state, imported);
    if (!isNil(twin)) {
      run.document = editCard(run.document, twin, at, current => replacing(current, incoming));
      run.document = withHotpCounters(run.document, { ...incoming, id: twin }, imported);
      outcome.replaced += 1;
      cardIds.push(twin);
      continue;
    }
    const card: IVaultCard = { ...incoming, history: [] };
    run.document = withHotpCounters(putCard(run.document, card), card, imported);
    if (!isNil(key)) {
      byKey.set(key, card.id);
    }
    outcome.added += 1;
    cardIds.push(card.id);
  }

  for (const [first, second] of batch.links) {
    const [a, b] = [cardIds[first], cardIds[second]];
    const linked = isNil(a) || isNil(b) ? null : linkCards(run.document, a, b, at);
    if (linked?.ok === true) {
      run.document = linked.value;
    }
  }
  const filesDropped = [...run.assetIds.values()].filter(isNil).length;
  return { document: run.document, result: { ...outcome, filesDropped } };
}
