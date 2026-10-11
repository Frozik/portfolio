import { FileDrop } from '@frozik/components/components/file-drop/FileDrop';
import type { IPickedFile } from '@frozik/components/components/file-drop/FileDrop';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import type { ICardField } from '@frozik/vault/model/card';
import type { TAssetId } from '@frozik/vault/model/ids';
import type { IAsset } from '@frozik/vault/model/vault-document';
import { X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import type { TAttachRefusal } from '../../domain/new-file';
import { vaultT } from '../translations';

const ICON_SIZE = 14;

function refusalText(refusal: TAttachRefusal): string {
  switch (refusal) {
    case 'too-large':
      return vaultT.files.tooLarge;
    case 'not-stored':
      return vaultT.files.notStored;
    case 'read-only':
      return vaultT.status.readOnly;
    default:
      return assertNever(refusal);
  }
}

/** A file field in the editor: pick, drop or paste (the camera on a phone), and remove. */
export const FileFieldEditor = observer(
  ({
    field,
    assets,
    onAttach,
    onDetach,
  }: {
    readonly field: ICardField;
    readonly assets: ReadonlyMap<TAssetId, IAsset>;
    readonly onAttach: (files: readonly IPickedFile[]) => Promise<readonly TAttachRefusal[]>;
    readonly onDetach: (assetId: TAssetId) => void;
  }) => {
    const t = vaultT.files;
    const [refusals, setRefusals] = useState<readonly TAttachRefusal[]>([]);
    const attach = useEventCallback((files: readonly IPickedFile[]) => {
      void onAttach(files).then(setRefusals);
    });
    return (
      <div className="flex flex-col gap-2">
        {fileAssetIdsOf(field).map(assetId => {
          const name = assets.get(assetId)?.name ?? assetId;
          return (
            <span key={assetId} className="flex items-center gap-2 text-[13px] text-landing-fg">
              {name}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t.remove(name)}
                onClick={() => onDetach(assetId)}
              >
                <X size={ICON_SIZE} />
              </Button>
            </span>
          );
        })}
        <FileDrop
          multiple={field.value.cardinality === 'list'}
          capture="environment"
          onFiles={attach}
          locale={getCurrentLanguage()}
          aria-label={field.label}
        >
          {t.drop}
        </FileDrop>
        {refusals.map(refusal => (
          <span key={refusal} className="text-[12px] text-error">
            {refusalText(refusal)}
          </span>
        ))}
      </div>
    );
  }
);
