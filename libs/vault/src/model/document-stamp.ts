import type { IHlc } from './hlc';
import { maxHlc } from './hlc';
import type { IVaultDocument } from './vault-document';

/** The latest stamp a document holds, so a clock that merged it in moves past everything it saw. */
export function latestStampOf(document: IVaultDocument): IHlc {
  const stamps = [
    ...[...document.cards.values()].map(card => card.updatedAt),
    ...[...document.groups.values()].map(group => group.updatedAt),
    ...[...document.templates.values()].map(template => template.updatedAt),
    ...[...document.smartGroups.values()].map(group => group.updatedAt),
    ...[...document.links.values()].map(link => link.createdAt),
    ...document.tombstones.values(),
    ...[...document.assets.values()].map(asset => asset.createdAt),
    ...[...document.siteIcons.values()].map(icon => icon.at),
  ];
  return stamps.reduce(maxHlc, document.settings.updatedAt);
}
