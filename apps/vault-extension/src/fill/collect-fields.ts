import { isNil } from 'lodash-es';

import type { IFieldRecord } from '../domain/autofill/field-record';

/** A closed shadow root is reachable only through the extension API. */
export type TOpenShadow = (element: Element) => ShadowRoot | null;

/**
 * Whether the browser draws the input with a size and on
 * the page (not pushed off it): a page could hide a field that way to collect
 * what is filled. The fill script measures; a document without layout cannot.
 */
export type TIsRendered = (input: HTMLInputElement) => boolean;

export interface ICollectedFields {
  readonly records: readonly IFieldRecord[];
  /** The input of each record, by its `index`. */
  readonly inputs: readonly HTMLInputElement[];
}

const SKIPPED_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
]);

/**
 * Hidden fields are never filled (a page could collect what it hides):
 * display and visibility up the tree, across shadow hosts, and the browser's
 * own check of opacity and layout where it has one.
 */
function isVisible(input: HTMLInputElement, isRendered: TIsRendered): boolean {
  const drawn =
    typeof input.checkVisibility !== 'function' ||
    input.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  return drawn && isShownUpTheTree(input) && isRendered(input);
}

function isShownUpTheTree(input: HTMLInputElement): boolean {
  let node: Element | null = input;
  while (!isNil(node)) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (
      node.hasAttribute('hidden') ||
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      node.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }
    const parent: Element | null = node.parentElement;
    const root = node.getRootNode();
    node = parent ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return true;
}

function labelText(input: HTMLInputElement): string {
  const labels = [...(input.labels ?? [])].map(label => label.textContent);
  const labelledBy = (input.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(id => id !== '')
    .map(id => input.ownerDocument.getElementById(id)?.textContent ?? '');
  return [...labels, ...labelledBy].join(' ');
}

function hintsOf(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    labelText(input),
  ]
    .join(' ')
    .toLowerCase();
}

/** Small numbers for objects, in the order they are first met: forms, roots, parents. */
function counter<T extends object>(): (key: T) => number {
  const keys = new Map<T, number>();
  return key => {
    const known = keys.get(key);
    if (!isNil(known)) {
      return known;
    }
    keys.set(key, keys.size);
    return keys.size - 1;
  };
}

/**
 * Every fillable input of the page in document order,
 * shadow roots included (closed ones through `openShadow`), as records the
 * detector reads. Frames are not entered: each frame runs this for itself.
 */
export function collectFields(
  document: Document,
  openShadow: TOpenShadow,
  isRendered: TIsRendered = () => true
): ICollectedFields {
  const inputs: HTMLInputElement[] = [];
  const records: IFieldRecord[] = [];
  const containerOf = counter<Node>();
  const parentOf = counter<Node>();
  const walk = (root: Document | ShadowRoot): void => {
    for (const element of root.querySelectorAll('*')) {
      if (element instanceof HTMLInputElement && !SKIPPED_TYPES.has(element.type)) {
        const maxLength = element.maxLength > 0 ? element.maxLength : null;
        records.push({
          index: inputs.length,
          type: element.type.toLowerCase(),
          autocomplete: element.autocomplete
            .toLowerCase()
            .split(/\s+/)
            .filter(token => token !== ''),
          hints: hintsOf(element),
          visible: isVisible(element, isRendered),
          enabled: !element.disabled && !element.readOnly,
          container: containerOf(element.form ?? root),
          parent: parentOf(element.parentNode ?? root),
          maxLength,
          inputMode: element.inputMode,
        });
        inputs.push(element);
      }
      const shadow = element.shadowRoot ?? openShadow(element);
      if (!isNil(shadow)) {
        walk(shadow);
      }
    }
  };
  walk(document);
  return { records, inputs };
}
