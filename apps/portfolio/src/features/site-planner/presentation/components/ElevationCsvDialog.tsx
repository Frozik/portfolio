import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import type { ChangeEvent } from 'react';
import { memo, useMemo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import type { ElevationMarkDraft } from '../../domain/model/parse-elevation-csv';
import { parseElevationCsv } from '../../domain/model/parse-elevation-csv';
import { sitePlannerT } from '../translations';

const TEXTAREA_ROWS = 10;
/** Enough skipped rows to spot the pattern; the rest would only be noise. */
const REPORTED_SKIPPED_LINE_COUNT = 5;
const LINE_NUMBER_SEPARATOR = ', ';
const ELLIPSIS = '…';

/**
 * Bulk entry of surveyed marks. Fifteen to thirty points is a normal survey, and
 * clicking each one in would be the slowest part of the whole feature — the
 * paste is what makes real data usable.
 */
export const ElevationCsvDialog = memo(
  ({
    open,
    onClose,
    onSubmit,
  }: {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (marks: readonly ElevationMarkDraft[]) => void;
  }) => {
    const [text, setText] = useState('');
    const { marks, skippedLineNumbers } = useMemo(() => parseElevationCsv(text), [text]);

    const handleChange = useFunction((event: ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    });

    const handleSubmit = useFunction(() => {
      onSubmit(marks);
      setText('');
      onClose();
    });

    const handleClose = useFunction(() => {
      setText('');
      onClose();
    });

    const footer = (
      <>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          {sitePlannerT.marks.csv.cancel}
        </Button>
        <Button size="sm" disabled={marks.length === 0} onClick={handleSubmit}>
          {sitePlannerT.marks.csv.submit}
        </Button>
      </>
    );

    return (
      <DialogShell
        open={open}
        onClose={handleClose}
        kicker={sitePlannerT.marks.csv.kicker}
        title={sitePlannerT.marks.csv.title}
        description={sitePlannerT.marks.csv.description}
        closeLabel={sitePlannerT.marks.csv.cancel}
        footer={footer}
      >
        <div className="flex flex-col gap-2">
          <textarea
            aria-label={sitePlannerT.marks.csv.title}
            rows={TEXTAREA_ROWS}
            value={text}
            onChange={handleChange}
            placeholder={sitePlannerT.marks.csv.placeholder}
            className={cn(
              'w-full resize-y rounded-sm border border-landing-border-soft bg-transparent p-2',
              'font-mono text-[12px] leading-[1.6] text-landing-fg',
              'placeholder:text-landing-fg-faint focus:border-landing-accent focus:outline-none'
            )}
          />
          <p className="font-mono text-[11px] text-landing-fg-dim">
            {sitePlannerT.marks.csv.parsed} {marks.length}
          </p>
          {skippedLineNumbers.length === 0 ? undefined : (
            <p role="alert" className="font-mono text-[11px] text-error">
              {sitePlannerT.marks.csv.skippedLines} {formatSkippedLines(skippedLineNumbers)}
            </p>
          )}
        </div>
      </DialogShell>
    );
  }
);

function formatSkippedLines(lineNumbers: readonly number[]): string {
  const reported = lineNumbers.slice(0, REPORTED_SKIPPED_LINE_COUNT).join(LINE_NUMBER_SEPARATOR);

  return lineNumbers.length > REPORTED_SKIPPED_LINE_COUNT ? `${reported}${ELLIPSIS}` : reported;
}
