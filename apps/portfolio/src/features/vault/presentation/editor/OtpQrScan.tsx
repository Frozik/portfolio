import { FileDrop } from '@frozik/components/components/file-drop/FileDrop';
import type { IPickedFile } from '@frozik/components/components/file-drop/FileDrop';
import { formatOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import type { TOtpScan } from '../../application/otp-scan';
import { editorT } from '../translations/editor';

/**
 * The code from a screenshot or a photo of its QR; from
 * Google Authenticator's transfer of several accounts the user picks one.
 */
export function OtpQrScan({
  onScan,
  onCode,
}: {
  readonly onScan: (image: {
    readonly bytes: Uint8Array<ArrayBuffer>;
    readonly mime: string;
  }) => Promise<TOtpScan>;
  readonly onCode: (uri: string) => void;
}) {
  const t = editorT.qr;
  const [scan, setScan] = useState<TOtpScan | null>(null);
  const take = useEventCallback((files: readonly IPickedFile[]) => {
    const [file] = files;
    if (isNil(file)) {
      return;
    }
    void onScan({ bytes: file.bytes, mime: file.type }).then(result => {
      setScan(result.kind === 'code' ? null : result);
      if (result.kind === 'code') {
        onCode(result.value);
      }
    });
  });
  return (
    <div className="flex flex-col gap-2">
      <FileDrop accept="image/*" capture="environment" onFiles={take} locale={getCurrentLanguage()}>
        {t.scan}
      </FileDrop>
      {scan?.kind === 'none' && <span className="text-[12px] text-error">{t.none}</span>}
      {scan?.kind === 'choose' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-landing-fg-dim">{t.choose}</span>
          {scan.codes.map(code => (
            <Button
              key={formatOtpUri(code)}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onCode(formatOtpUri(code));
                setScan(null);
              }}
            >
              {code.issuer === null ? code.label : `${code.issuer} · ${code.label}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
