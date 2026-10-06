import type { DescMessage, JsonValue, MessageShape } from '@bufbuild/protobuf';
import { toJson } from '@bufbuild/protobuf';

const MAX_STRING_CHARS = 120;
const MAX_ARRAY_ITEMS = 16;

/**
 * A message as JSON a log line can hold: long strings — base64 of `bytes`
 * among them — and long lists are cut, and say how long they were.
 */
export function summarizeMessage<Desc extends DescMessage>(
  schema: Desc,
  message: MessageShape<Desc>
): JsonValue {
  return summarize(toJson(schema, message));
}

function summarize(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value.length <= MAX_STRING_CHARS
      ? value
      : `${value.slice(0, MAX_STRING_CHARS)}… (${value.length} chars)`;
  }
  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ARRAY_ITEMS).map(summarize);
    return value.length <= MAX_ARRAY_ITEMS ? kept : [...kept, `… (${value.length} items)`];
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, summarize(item)]));
  }
  return value;
}
