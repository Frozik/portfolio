import { isNil } from 'lodash-es';

const MAX_DEPTH = 3;
const MAX_KEYS = 20;
const MAX_ITEMS = 20;
const MAX_STRING = 2_000;
const ELEMENT_NODE = 1;

interface IErrorLike {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: unknown;
}

interface INodeLike {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly id?: string;
  readonly className?: unknown;
}

/** Renders console arguments the way DevTools prints them, within fixed size limits and without ever throwing. */
export function formatConsoleArguments(args: readonly unknown[]): string {
  return args.map(argument => describeValue(argument)).join(' ');
}

export function describeValue(value: unknown): string {
  return safely(() => describe(value, 0, new WeakSet()), '[Unserializable]');
}

function describe(value: unknown, depth: number, seen: WeakSet<object>): string {
  switch (typeof value) {
    case 'string':
      return depth === 0 ? truncate(value) : JSON.stringify(truncate(value));
    case 'number':
    case 'boolean':
    case 'undefined':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return value.toString();
    case 'function':
      return `[Function ${value.name === '' ? 'anonymous' : value.name}]`;
    case 'object':
      return isNil(value) ? 'null' : describeObject(value, depth, seen);
    default:
      return '[unknown]';
  }
}

function describeObject(value: object, depth: number, seen: WeakSet<object>): string {
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (isErrorLike(value)) {
    return describeError(value, depth, seen);
  }
  if (isNodeLike(value)) {
    return describeNode(value);
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[${value.constructor.name} ${value.byteLength} bytes]`;
  }
  if (hasIsoString(value)) {
    return safely(() => value.toISOString(), '[Date]');
  }
  if (depth >= MAX_DEPTH) {
    return Array.isArray(value) ? `[Array(${value.length})]` : `[${constructorName(value)}]`;
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return describeList(value, depth, seen, '[', ']');
    }
    if (value instanceof Map) {
      return `Map ${describeList([...value.entries()], depth, seen, '{', '}')}`;
    }
    if (value instanceof Set) {
      return `Set ${describeList([...value], depth, seen, '{', '}')}`;
    }
    return describeRecord(value, depth, seen);
  } finally {
    seen.delete(value);
  }
}

function describeList(
  items: readonly unknown[],
  depth: number,
  seen: WeakSet<object>,
  open: string,
  close: string
): string {
  const shown = items.slice(0, MAX_ITEMS).map(item => describe(item, depth + 1, seen));
  const rest = items.length > MAX_ITEMS ? [`… ${items.length - MAX_ITEMS} more`] : [];
  return `${open}${[...shown, ...rest].join(', ')}${close}`;
}

function describeRecord(value: object, depth: number, seen: WeakSet<object>): string {
  const keys = Object.keys(value);
  const shown = keys.slice(0, MAX_KEYS).map(key => {
    const field = safely(() => describe(Reflect.get(value, key), depth + 1, seen), '[Throws]');
    return `${key}: ${field}`;
  });
  const rest = keys.length > MAX_KEYS ? [`… ${keys.length - MAX_KEYS} more`] : [];
  const name = constructorName(value);
  const prefix = name === 'Object' ? '' : `${name} `;
  return `${prefix}{${[...shown, ...rest].join(', ')}}`;
}

function describeError(error: IErrorLike, depth: number, seen: WeakSet<object>): string {
  const head = `${error.name}: ${truncate(error.message)}`;
  const stack = isNil(error.stack) || error.stack === '' ? '' : `\n${truncate(error.stack)}`;
  const cause =
    isNil(error.cause) || depth >= MAX_DEPTH
      ? ''
      : `\nCaused by: ${describe(error.cause, depth + 1, seen)}`;
  return `${head}${stack}${cause}`;
}

function describeNode(node: INodeLike): string {
  const tag = node.nodeName.toLowerCase();
  if (node.nodeType !== ELEMENT_NODE) {
    return `<${tag}>`;
  }
  const id = isNil(node.id) || node.id === '' ? '' : `#${node.id}`;
  const classes =
    typeof node.className === 'string' && node.className !== ''
      ? `.${node.className.trim().split(/\s+/).join('.')}`
      : '';
  return `<${tag}${id}${classes}>`;
}

function isErrorLike(value: object): value is IErrorLike {
  return (
    value instanceof Error ||
    (typeof Reflect.get(value, 'message') === 'string' &&
      typeof Reflect.get(value, 'name') === 'string' &&
      typeof Reflect.get(value, 'stack') === 'string')
  );
}

function isNodeLike(value: object): value is INodeLike {
  return (
    typeof Reflect.get(value, 'nodeType') === 'number' &&
    typeof Reflect.get(value, 'nodeName') === 'string'
  );
}

function hasIsoString(value: object): value is { toISOString(): string } {
  return typeof Reflect.get(value, 'toISOString') === 'function';
}

function constructorName(value: object): string {
  const name = Object.getPrototypeOf(value)?.constructor?.name;
  return typeof name === 'string' && name !== '' ? name : 'Object';
}

function safely(read: () => string, fallback: string): string {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function truncate(text: string): string {
  return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}… (${text.length} chars)` : text;
}
