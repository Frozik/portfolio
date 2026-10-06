import type { DescField, DescMessage, DescMethod } from '@bufbuild/protobuf';
import { ScalarType } from '@bufbuild/protobuf';

import type { WireFormat } from '../shared/wire-format';

const carriesBytesCache = new WeakMap<DescMessage, boolean>();

/**
 * Binary protobuf unless the JSON wire is asked for; even then methods that
 * move `bytes` stay binary. Derived from the schema, so a contract change
 * picks the right codec by itself.
 */
export function usesBinaryCodec(method: DescMethod, format: WireFormat): boolean {
  return format === 'binary' || carriesBytes(method.input) || carriesBytes(method.output);
}

function carriesBytes(message: DescMessage): boolean {
  const cached = carriesBytesCache.get(message);
  if (cached !== undefined) {
    return cached;
  }
  const result = search(message, new Set());
  carriesBytesCache.set(message, result);
  return result;
}

function search(message: DescMessage, visiting: Set<DescMessage>): boolean {
  if (visiting.has(message)) {
    return false;
  }
  visiting.add(message);
  return message.fields.some(field => fieldCarriesBytes(field, visiting));
}

function fieldCarriesBytes(field: DescField, visiting: Set<DescMessage>): boolean {
  switch (field.fieldKind) {
    case 'scalar':
      return field.scalar === ScalarType.BYTES;
    case 'message':
      return search(field.message, visiting);
    case 'list':
      if (field.listKind === 'scalar') {
        return field.scalar === ScalarType.BYTES;
      }
      return field.listKind === 'message' && search(field.message, visiting);
    case 'map':
      if (field.mapKind === 'scalar') {
        return field.scalar === ScalarType.BYTES;
      }
      return field.mapKind === 'message' && search(field.message, visiting);
    case 'enum':
      return false;
  }
}
