import { isNil } from 'lodash-es';
import { FileDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { DragEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import type { VaultFileOpening } from '@frozik/vault-app/cloud/application/VaultFileOpening';
import { vaultFileOf } from '@frozik/vault-browser/interchange/vault-file-picker';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

const ICON_SIZE = 40;
const FILES = 'Files';

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(FILES);
}

/** The whole first screen takes a dropped `.pwv`: the vault joins this device and its unlock opens. */
export const VaultFileDrop = observer(
  ({ opening, children }: { readonly opening: VaultFileOpening; readonly children: ReactNode }) => {
    const navigate = useNavigate();
    const [over, setOver] = useState(false);
    const depth = useRef(0);

    const enter = useEventCallback((event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      depth.current += 1;
      setOver(true);
    });
    const hover = useEventCallback((event: DragEvent<HTMLDivElement>) => {
      if (carriesFiles(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    });
    const leave = useEventCallback(() => {
      depth.current = Math.max(0, depth.current - 1);
      setOver(depth.current > 0);
    });
    const drop = useEventCallback(async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      depth.current = 0;
      setOver(false);
      const file = event.dataTransfer.files.item(0);
      if (isNil(file)) {
        return;
      }
      const vaultKey = await opening.adopt(await vaultFileOf(file));
      if (!isNil(vaultKey)) {
        void navigate(paths.vault(vaultKey));
      }
    });

    return (
      <div
        className="relative min-h-dvh"
        data-testid="vault-drop"
        data-state={over ? 'over' : 'idle'}
        onDragEnter={enter}
        onDragOver={hover}
        onDragLeave={leave}
        onDrop={event => void drop(event)}
      >
        {children}
        {over && (
          <div className="pointer-events-none fixed inset-3 z-50 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-bg/90 text-[17px] text-fg">
            <FileDown size={ICON_SIZE} aria-hidden className="text-accent" />
            {vaultT.phone.dropFile}
          </div>
        )}
      </div>
    );
  }
);
