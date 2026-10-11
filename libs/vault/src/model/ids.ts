import type { Brand } from '@frozik/utils/types/base';

import type { IRandom } from '../ports/random';

export type TCardId = Brand<string, 'CardId'>;
export type TTabId = Brand<string, 'TabId'>;
export type TFieldId = Brand<string, 'FieldId'>;
export type TGroupId = Brand<string, 'GroupId'>;
export type TAssetId = Brand<string, 'AssetId'>;
export type TTemplateId = Brand<string, 'TemplateId'>;
export type TLinkId = Brand<string, 'LinkId'>;

const UUID_BYTES = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;
const VERSION_4 = 0x40;
const VARIANT_RFC_4122 = 0x80;
const LOW_NIBBLE = 0x0f;
const LOW_SIX_BITS = 0x3f;
const HEX_RADIX = 16;
const UUID_GROUPS = [8, 4, 4, 4, 12] as const;

/** A random version-4 UUID from the injected randomness, so tests and fixtures stay reproducible. */
export function randomUuid(random: IRandom): string {
  const bytes = random.bytes(UUID_BYTES);
  bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & LOW_NIBBLE) | VERSION_4;
  bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & LOW_SIX_BITS) | VARIANT_RFC_4122;
  const hex = Array.from(bytes, byte => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
  let offset = 0;
  return UUID_GROUPS.map(length => {
    const group = hex.slice(offset, offset + length);
    offset += length;
    return group;
  }).join('-');
}

export function newCardId(random: IRandom): TCardId {
  return randomUuid(random) as TCardId;
}

export function newTabId(random: IRandom): TTabId {
  return randomUuid(random) as TTabId;
}

export function newFieldId(random: IRandom): TFieldId {
  return randomUuid(random) as TFieldId;
}

export function newGroupId(random: IRandom): TGroupId {
  return randomUuid(random) as TGroupId;
}

/** A user template's id never meets a built-in one: those are words, this one a prefixed UUID. */
export function newUserTemplateId(random: IRandom): TTemplateId {
  return `user-${randomUuid(random)}` as TTemplateId;
}

/** A smart group of the user's: a group id the sidebar and the URL take as any other. */
export function newSmartGroupId(random: IRandom): TGroupId {
  return `smart-${randomUuid(random)}` as TGroupId;
}

export function newAssetId(random: IRandom): TAssetId {
  return randomUuid(random) as TAssetId;
}
