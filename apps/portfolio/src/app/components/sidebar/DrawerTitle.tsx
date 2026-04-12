import { QrCode } from 'lucide-react';
import { memo } from 'react';
import { SvgGitHub } from '../../../icons/SvgGitHub';

export const DrawerTitle = memo(({ onToggleQR }: { onToggleQR: () => void }) => (
  <span className="flex items-center gap-2">
    <a
      href="https://github.com/frozik/portfolio"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-text hover:text-text-secondary"
    >
      <SvgGitHub width={16} height={16} />
      <span className="font-mono text-sm">Frozik/portfolio</span>
    </a>
    <button
      className="cursor-pointer rounded-md p-1 text-text-secondary hover:bg-surface-overlay hover:text-text"
      onClick={onToggleQR}
    >
      <QrCode size={18} />
    </button>
  </span>
));
