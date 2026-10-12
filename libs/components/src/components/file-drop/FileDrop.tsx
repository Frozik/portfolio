import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from 'react';
import { useMemo, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import { getCalendarAriaLabels } from '../RichEditor/translations/translations';
import { acceptsFile } from './accept-file';
import controlTokens from '../control-tokens.module.css';
import styles from './file-drop.module.css';

export interface IPickedFile {
  readonly name: string;
  readonly type: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

async function readFile(file: File): Promise<IPickedFile> {
  return { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/**
 * Files from the picker, a drop or a paste, handed to the
 * owner as bytes. `accept` filters every route alike; `capture` opens the
 * camera on a phone. Compressing or storing the bytes is the owner's job.
 */
export function FileDrop({
  className,
  accept,
  capture,
  multiple = false,
  disabled = false,
  locale = 'en',
  onFiles,
  children,
  'aria-label': ariaLabel,
}: {
  readonly className?: string;
  readonly accept?: string;
  readonly capture?: 'user' | 'environment';
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly locale?: string;
  readonly onFiles: (files: readonly IPickedFile[]) => void;
  /** What the zone says; the default tells all three ways in. */
  readonly children?: ReactNode;
  readonly 'aria-label'?: string;
}) {
  const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);

  const take = useEventCallback((files: readonly File[]) => {
    if (disabled || files.length === 0) {
      return;
    }
    const accepted = files.filter(file => acceptsFile(file, accept));
    setRejected(accepted.length < files.length);
    const taken = multiple ? accepted : accepted.slice(0, 1);
    if (taken.length > 0) {
      void Promise.all(taken.map(readFile)).then(onFiles, () => setRejected(true));
    }
  });

  const openPicker = useEventCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  });
  /** The input's own click bubbles here too; opening the picker again from it would be re-entrant. */
  const handleClick = useEventCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== inputRef.current) {
      openPicker();
    }
  });
  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  });
  const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) => {
    take([...(event.target.files ?? [])]);
    event.target.value = '';
  });
  const handleDragOver = useEventCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(!disabled);
  });
  const handleDragLeave = useEventCallback((event: DragEvent<HTMLDivElement>) => {
    const to = event.relatedTarget;
    if (!(to instanceof Node) || !event.currentTarget.contains(to)) {
      setDragging(false);
    }
  });
  const handleDrop = useEventCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    take([...event.dataTransfer.files]);
  });
  const handlePaste = useEventCallback((event: ClipboardEvent<HTMLDivElement>) => {
    const files = [...event.clipboardData.files];
    if (files.length > 0) {
      event.preventDefault();
      take(files);
    }
  });

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(controlTokens.tokens, styles.zone, className)}
      data-dragging={dragging || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <input
        ref={inputRef}
        type="file"
        className={styles.input}
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        onChange={handleChange}
      />
      {children ?? <span className={styles.hint}>{labels.fileDropHint}</span>}
      {rejected && (
        <span className={styles.rejected} role="alert">
          {labels.filesRejected}
        </span>
      )}
    </div>
  );
}
