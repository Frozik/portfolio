import { AlertCircle } from 'lucide-react';

import { retroT as t } from '../translations';

const ICON_SIZE_PX = 36;

export const SignalingUnavailable = () => (
  <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <AlertCircle className="text-landing-red" size={ICON_SIZE_PX} strokeWidth={1.5} />
      <span className="font-mono text-[10.5px] uppercase tracking-widest text-landing-red">
        {t.errors.signalingKicker}
      </span>
      <h2 className="text-[20px] font-medium text-landing-fg">
        {t.errors.signalingUnavailableTitle}
      </h2>
      <p className="whitespace-pre-wrap text-[13.5px] font-light text-landing-fg-dim">
        {t.errors.signalingUnavailableBody}
      </p>
    </div>
  </div>
);
