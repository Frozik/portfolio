import { isNil } from 'lodash-es';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IListboxOption } from './listbox-navigation';
import { isTypeaheadKey, listboxMoveOf, moveActive, typeaheadMatch } from './listbox-navigation';
import { useTypeahead } from './use-typeahead';

/** Whether the list is open and which option the keyboard is on, for a field that keeps focus. */
export function useListbox(options: readonly IListboxOption<string>[], locale: string) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | undefined>(undefined);
  const typeahead = useTypeahead();

  const openAt = useEventCallback((index: number | undefined) => {
    setActive(index ?? moveActive(options, undefined, 'first'));
    setOpen(true);
  });
  const close = useEventCallback(() => setOpen(false));

  /** Arrows, Home/End and typed letters while the list is open; whether the key was one of them. */
  const navigate = useEventCallback((event: KeyboardEvent): boolean => {
    const move = listboxMoveOf(event.key);
    if (!isNil(move)) {
      setActive(moveActive(options, active, move));
    } else if (isTypeaheadKey(event) && event.key !== ' ') {
      setActive(typeaheadMatch(options, typeahead(event.key), active, locale) ?? active);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  });

  return { open, active, setActive, openAt, close, navigate };
}
