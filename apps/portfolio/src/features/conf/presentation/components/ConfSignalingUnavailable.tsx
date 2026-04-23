import { AlertTriangle } from 'lucide-react';

import { confT } from '../translations';

const ICON_SIZE = 40;

export const ConfSignalingUnavailable = () => {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-center text-text">
        <AlertTriangle className="text-red-400" size={ICON_SIZE} />
        <h2 className="text-xl font-semibold">{confT.errors.signalingUnavailableTitle}</h2>
        <p className="whitespace-pre-wrap text-sm text-text-muted">
          {confT.errors.signalingUnavailableBody}
        </p>
      </div>
    </div>
  );
};
