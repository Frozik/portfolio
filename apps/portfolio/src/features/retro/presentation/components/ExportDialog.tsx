import { useFunction } from '@frozik/components';
import * as Dialog from '@radix-ui/react-dialog';
import { Copy, Download, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { renderSnapshotToMarkdown } from '../../domain/markdown-export';
import { downloadFile, writeTextToClipboard } from '../../infrastructure/clipboard';
import { retroEnTranslations as t } from '../translations/en';

interface ExportDialogProps {
  readonly store: RoomStore;
}

export const ExportDialog = observer(({ store }: ExportDialogProps) => {
  const snapshot = store.currentSnapshot;

  const markdown = useMemo(() => {
    if (snapshot === null) {
      return '';
    }
    return renderSnapshotToMarkdown(snapshot);
  }, [snapshot]);

  const handleCopy = useFunction(() => {
    void writeTextToClipboard(markdown).then(
      () => store.showToast(t.room.linkCopied),
      () => store.showToast(t.errors.copyFailed)
    );
  });

  const handleDownload = useFunction(() => {
    const safeName = snapshot?.meta.name.replace(/[^a-z0-9-]+/gi, '_') ?? 'retro';
    downloadFile(`${safeName}.md`, markdown, 'text/markdown');
  });

  const handleOpenChange = useFunction((open: boolean) => {
    if (!open) {
      store.closeExportDialog();
    }
  });

  return (
    <Dialog.Root open={store.isExportDialogOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 flex max-h-[80vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-text shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-text">
              {t.close.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="text-text-secondary hover:text-text"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-text-secondary">
            {t.close.summarySubtitle}
          </Dialog.Description>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-elevated p-3 text-xs leading-relaxed text-text">
            {markdown}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy size={14} /> {t.close.exportCopy}
            </Button>
            <Button variant="primary" size="sm" onClick={handleDownload}>
              <Download size={14} /> {t.close.exportDownload}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
