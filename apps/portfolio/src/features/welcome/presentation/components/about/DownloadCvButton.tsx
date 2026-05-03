import { useFunction } from '@frozik/components/hooks/useFunction';
import { Download, Loader2 } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../../shared/lib/cn';
import { welcomeT } from '../../translations';

const ICON_SIZE_PX = 14;

const DownloadCvButtonComponent = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = useFunction(async () => {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    try {
      const { downloadCvPdf } = await import('../../pdf/generateCvPdf');
      await downloadCvPdf();
    } finally {
      setIsGenerating(false);
    }
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isGenerating}
      className={cn(
        'mt-4 flex w-full items-center justify-center gap-2 rounded-sm',
        'border border-landing-border bg-landing-bg-card px-3 py-2.5',
        'font-mono text-[12px] text-landing-fg-dim',
        'transition-colors',
        'hover:border-landing-accent hover:bg-landing-accent/10 hover:text-landing-accent',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent',
        'disabled:cursor-wait disabled:opacity-70 disabled:hover:border-landing-border disabled:hover:bg-landing-bg-card disabled:hover:text-landing-fg-dim',
        'print:hidden'
      )}
    >
      {isGenerating ? (
        <Loader2 size={ICON_SIZE_PX} className="animate-spin" aria-hidden="true" />
      ) : (
        <Download size={ICON_SIZE_PX} aria-hidden="true" />
      )}
      <span>{isGenerating ? welcomeT.contacts.downloadingCv : welcomeT.contacts.downloadCv}</span>
    </button>
  );
};

export const DownloadCvButton = memo(DownloadCvButtonComponent);
