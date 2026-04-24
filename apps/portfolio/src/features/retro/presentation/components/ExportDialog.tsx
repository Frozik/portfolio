import { useFunction } from '@frozik/components/hooks/useFunction';
import copy from 'copy-to-clipboard';
import DOMPurify from 'dompurify';
import { Check, Copy, Download } from 'lucide-react';
import { marked } from 'marked';
import { observer } from 'mobx-react-lite';
import { useMemo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import type { RoomStore } from '../../application/RoomStore';
import { renderSnapshotToMarkdown } from '../../domain/markdown-export';
import { downloadFile } from '../../infrastructure/downloads';
import { retroT as t } from '../translations';

const COPY_RESET_DELAY_MS = 1800;
const ICON_SIZE_PX = 12;
const SAFE_NAME_PATTERN = /[^a-z0-9-]+/gi;
const SAFE_NAME_FALLBACK = 'retro';

const PROSE_CLASSES = cn(
  '[&_h1]:m-0 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-landing-border-soft [&_h1]:pb-3',
  '[&_h1]:text-[16px] [&_h1]:font-medium [&_h1]:text-landing-fg',
  '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-mono [&_h2]:text-[11px] [&_h2]:font-semibold',
  '[&_h2]:tracking-[0.08em] [&_h2]:text-landing-accent [&_h2]:uppercase',
  '[&_h2:first-of-type]:mt-0',
  '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-mono [&_h3]:text-[10px] [&_h3]:font-normal',
  '[&_h3]:tracking-[0.08em] [&_h3]:text-landing-fg-dim [&_h3]:uppercase',
  '[&_p]:my-1 [&_p]:text-[13px] [&_p]:leading-[1.55] [&_p]:text-landing-fg',
  '[&_ul]:m-0 [&_ul]:my-1 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-4',
  '[&_li]:text-[13px] [&_li]:leading-[1.55] [&_li]:text-landing-fg',
  '[&_li]:marker:text-landing-fg-faint',
  '[&_em]:font-mono [&_em]:text-[11px] [&_em]:not-italic [&_em]:text-landing-fg-faint',
  '[&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:accent-landing-accent'
);

interface ExportDialogProps {
  readonly store: RoomStore;
}

export const ExportDialog = observer(({ store }: ExportDialogProps) => {
  const snapshot = store.currentSnapshot;
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    if (snapshot === null) {
      return '';
    }
    return renderSnapshotToMarkdown(snapshot, t.markdown);
  }, [snapshot]);

  const htmlContent = useMemo(() => {
    if (markdown === '') {
      return '';
    }
    const rawHtml = marked.parse(markdown, { gfm: true, async: false });
    return DOMPurify.sanitize(rawHtml);
  }, [markdown]);

  const handleCopy = useFunction(() => {
    const ok = copy(markdown);
    store.showToast(ok ? t.room.linkCopied : t.errors.copyFailed);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
    }
  });

  const handleDownload = useFunction(() => {
    const safeName = snapshot?.meta.name.replace(SAFE_NAME_PATTERN, '_') ?? SAFE_NAME_FALLBACK;
    downloadFile(`${safeName}.md`, markdown, 'text/markdown');
  });

  const handleClose = useFunction(() => {
    store.closeExportDialog();
  });

  const footer = (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'border border-landing-accent-dim text-landing-accent',
          'hover:border-landing-accent hover:bg-landing-accent/10'
        )}
      >
        {copied ? <Check size={ICON_SIZE_PX} /> : <Copy size={ICON_SIZE_PX} />}
        {copied ? t.share.copied : t.close.exportCopy}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
        )}
      >
        <Download size={ICON_SIZE_PX} />
        {t.close.exportDownload}
      </button>
    </>
  );

  return (
    <DialogShell
      open={store.isExportDialogOpen}
      onClose={handleClose}
      kicker={t.close.exportKicker}
      title={t.close.title}
      description={t.close.summarySubtitle}
      className="w-[min(92vw,640px)]"
      footer={footer}
    >
      <div
        className={cn(
          'max-h-[50vh] overflow-auto rounded-sm border border-landing-border-soft bg-landing-bg-elev px-5 py-4',
          PROSE_CLASSES
        )}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is produced internally by renderSnapshotToMarkdown and the HTML is sanitized via DOMPurify before injection
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </DialogShell>
  );
});
