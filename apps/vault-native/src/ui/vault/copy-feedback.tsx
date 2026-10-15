import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { createContext, useContext } from 'react';

const CopyFeedbackContext = createContext<((label: string) => void) | null>(null);

/** What a copy tells the snackbar of the open vault: the copied field's label. */
export const CopyFeedbackProvider = CopyFeedbackContext;

export function useCopied(): (label: string) => void {
  const copied = useContext(CopyFeedbackContext);
  assert(!isNil(copied), 'useCopied is used outside an open vault');
  return copied;
}
