import { observer } from 'mobx-react-lite';
import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type { IEditingSlice } from '../../../extensions/editing/core';
import type { ICellContext } from '../../column';
import { useTableContext } from '../../context';
import type { IEditorProps } from './editing-column';
import { editorFor } from './editorFor';

/** Hosts the editor of the cell while a session is on it; Enter, Tab and Escape end the session here. */
export const EditorOverlay = observer(function EditorOverlay<TRow>(context: ICellContext<TRow>) {
  const { table, rowKey, column } = context;
  const { locale } = useTableContext<TRow>();
  const slice = table.extension<IEditingSlice<TRow>>('editing');
  assert(slice !== undefined, 'EditorOverlay renders only with the editing extension');
  const session = slice.isEditing(rowKey, column.id) ? slice.current : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const editor = useMemo(
    () => (session === null ? undefined : editorFor(context)),
    [session === null, context]
  );

  const finish = useEventCallback((move: 'down' | 'right' | undefined) => {
    if (!slice.commit()) {
      return;
    }
    if (move !== undefined) {
      table.focus.move(move);
    }
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Enter':
        finish(slice.enterMovesDown ? 'down' : undefined);
        break;
      case 'Tab':
        finish(event.shiftKey ? undefined : 'right');
        break;
      case 'Escape':
        slice.cancel();
        break;
      default:
        event.stopPropagation();
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  useEffect(() => {
    if (session === null) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Element &&
        (containerRef.current?.contains(target) === true ||
          target.closest('[role="dialog"]') !== null);
      if (!inside) {
        slice.commit();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [session === null, slice]);

  if (session === null || editor?.component === undefined) {
    return null;
  }
  const Editor = editor.component;
  const props: IEditorProps<TRow> = {
    ...context,
    draft: session.draft,
    validation: session.validation,
    initialKey: session.initialKey,
    locale,
    options: editor.options,
    onChange: slice.update,
    commit: () => finish(undefined),
    cancel: slice.cancel,
  };
  return (
    <div
      ref={containerRef}
      className="ft-editor"
      data-popup={editor.popup ? '' : undefined}
      data-invalid={session.validation?.level === 'error' ? '' : undefined}
      data-warning={session.validation?.level === 'warning' ? '' : undefined}
      title={session.validation?.message}
      onKeyDown={handleKeyDown}
    >
      <Editor {...props} />
    </div>
  );
});
