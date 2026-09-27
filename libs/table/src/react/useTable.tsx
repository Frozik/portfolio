import { useEffect, useReducer, useRef } from 'react';

import type { TTable } from '../core/create-table';
import { createTable } from '../core/create-table';
import type { ITableOptions, TAnyExtension } from '../core/table-options';

/**
 * Creates the model once for the component's lifetime and disposes it on
 * unmount. Later column changes reach the model through `setColumns`, so
 * state survives a new `columns` reference. Strict mode in development
 * calls state initialisers twice and unmounts once: the model lives in a ref
 * so only one is ever created per mount, and one disposed by the remount is
 * replaced.
 */
export function useTable<
  TRow,
  TContext = undefined,
  const TExtensions extends readonly TAnyExtension<TRow>[] = readonly [],
>(options: ITableOptions<TRow, TContext, TExtensions>): TTable<TRow, TContext, TExtensions> {
  const modelRef = useRef<TTable<TRow, TContext, TExtensions> | null>(null);
  const latestOptions = useRef(options);
  latestOptions.current = options;
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  if (modelRef.current === null || modelRef.current.disposed) {
    modelRef.current = createTable(options);
  }
  const model = modelRef.current;
  const { columns } = options;

  useEffect(() => {
    if (model.disposed) {
      modelRef.current = createTable(latestOptions.current);
      rerender();
      return undefined;
    }
    return () => model.dispose();
  }, [model]);

  useEffect(() => {
    model.setColumns(columns);
  }, [model, columns]);

  return model;
}
