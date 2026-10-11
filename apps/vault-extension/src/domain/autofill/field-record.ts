/**
 * An input of the page as the detector sees it: no
 * element, only what decides its role. The collector makes these from the
 * DOM; the detector never touches it, so it is tested on plain records too.
 */
export interface IFieldRecord {
  /** Position in document order, shadow roots included: the plan names fields by it. */
  readonly index: number;
  readonly type: string;
  readonly autocomplete: readonly string[];
  /** `name`, `id`, `placeholder`, `aria-label` and the label's text, lower-cased. */
  readonly hints: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  /** The form the field belongs to, or its root (document, shadow root) when it is in none. */
  readonly container: number;
  /** The field's parent element: split one-time-code boxes share one. */
  readonly parent: number;
  readonly maxLength: number | null;
  readonly inputMode: string;
}
