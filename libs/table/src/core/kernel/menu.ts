export interface IMenuContext<TRow> {
  readonly target: 'cell' | 'header';
  readonly columnId: string | undefined;
  readonly rowKey: string | undefined;
  readonly row: TRow | undefined;
}

/**
 * A menu entry. `label` is a translation key of the view (`menu.sort.asc`) for
 * built-in items and plain text for the application's; `disabled` may carry
 * the reason, shown as a hint instead of hiding the item.
 */
export type TMenuItem =
  | {
      readonly id: string;
      readonly label: string;
      readonly section?: string;
      readonly disabled?: boolean | string;
      readonly danger?: boolean;
      run(): void;
    }
  | { readonly separator: true };
