import { cn } from '@frozik/components/components/cn';
import type { TAssetId } from '@frozik/vault/model/ids';
import type { IAsset } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import { ExternalLink, Eye, FileText } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { SENSITIVE_CLASS } from '../sensitive-class';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import type { TFileState } from '@frozik/vault-app/document/application/VaultFiles';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { vaultT } from '../texts/vault';
import { openClosingOnLeave } from './close-on-leave';

const BYTES_PER_KIB = 1024;
const ICON_SIZE = 18;
const ACTION_ICON_SIZE = 14;
const PDF = 'application/pdf';

/**
 * A file as the card shows it: an image as a thumbnail that
 * opens large, a PDF in a tab of its own that closes with the lock (Chrome
 * will not draw one in a sandboxed frame, iOS only its first page), anything
 * else by name and size. A secret file stays blurred until shown. A file
 * kept beside the vault is read each time the preview shows.
 */
export const AssetPreview = memo(
  ({
    asset,
    file,
    onLoad,
    sensitive,
  }: {
    readonly asset: IAsset | undefined;
    readonly file: TFileState;
    readonly onLoad: (assetId: TAssetId) => void;
    readonly sensitive: boolean;
  }) => {
    const t = vaultT.files;
    const [shown, setShown] = useState(!sensitive);
    const [opened, setOpened] = useState(false);
    const bytes = file.kind === 'ready' ? file.bytes : undefined;
    const url = useObjectUrl(bytes, asset?.mime ?? '');
    const assetId = asset?.id;
    useEffect(() => {
      if (!isNil(assetId)) {
        onLoad(assetId);
      }
    }, [assetId, onLoad]);
    if (file.kind === 'loading' || file.kind === 'idle') {
      return <span className="text-[12px] text-landing-fg-faint">{t.loading}</span>;
    }
    if (isNil(asset) || isNil(bytes)) {
      return <Alert type="warning" message={t.missing} />;
    }
    const image = asset.mime.startsWith('image/');
    const pdf = asset.mime === PDF;
    const size = t.size(Math.max(1, Math.round(bytes.byteLength / BYTES_PER_KIB)));

    return (
      <div className={cn('flex flex-wrap items-center gap-3', sensitive && SENSITIVE_CLASS)}>
        {image && !isNil(url) ? (
          <button type="button" onClick={() => setOpened(true)} disabled={!shown}>
            <img
              src={url}
              alt={asset.name}
              className={cn('h-20 w-20 rounded-md object-cover', !shown && 'blur-md')}
            />
          </button>
        ) : (
          <FileText size={ICON_SIZE} aria-hidden="true" />
        )}
        <span className="flex flex-col text-[13px] text-landing-fg">
          <span>{asset.name}</span>
          <span className="text-[12px] text-landing-fg-faint">{size}</span>
        </span>
        {!shown && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.show}
            title={t.show}
            onClick={() => setShown(true)}
          >
            <Eye size={ACTION_ICON_SIZE} />
          </Button>
        )}
        {shown && pdf && !isNil(url) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.open}
            title={t.open}
            onClick={() => openClosingOnLeave(url)}
          >
            <ExternalLink size={ACTION_ICON_SIZE} />
          </Button>
        )}
        {opened && !isNil(url) && (
          <DialogShell open onClose={() => setOpened(false)} title={asset.name}>
            <img src={url} alt={asset.name} className="max-h-[70vh] w-full object-contain" />
          </DialogShell>
        )}
      </div>
    );
  }
);
