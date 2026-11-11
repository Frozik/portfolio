import { formatOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TOtpScan } from '@frozik/vault-app/document/domain/otp-scan';

import { pickOneImage } from '../../device-files/pick-files';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { QrCamera } from './QrCamera';

/**
 * A one-time code from its QR, through the camera or from a screenshot; from Google
 * Authenticator's transfer of several accounts the user picks one.
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
  const palette = usePalette();
  const t = useEditorTexts().qr;
  const [scan, setScan] = useState<TOtpScan | null>(null);
  const [camera, setCamera] = useState(false);
  const [reading, setReading] = useState(false);
  const take = (result: TOtpScan): void => {
    setScan(result.kind === 'code' ? null : result);
    if (result.kind === 'code') {
      onCode(result.value);
    }
  };
  const fromPicture = (): void => {
    setReading(true);
    void pickOneImage()
      .then(async image => {
        if (!isNil(image)) {
          take(await onScan({ bytes: image.bytes, mime: image.type }));
        }
      })
      .finally(() => setReading(false));
  };
  return (
    <View style={styles.scan}>
      <View style={styles.buttons}>
        <Button
          testID="otp-scan-camera"
          variant="secondary"
          compact
          icon="qr-code-scanner"
          label={t.phone.camera}
          onPress={() => setCamera(true)}
        />
        <Button
          testID="otp-scan-picture"
          variant="secondary"
          compact
          icon="image"
          label={t.phone.picture}
          disabled={reading}
          onPress={fromPicture}
        />
      </View>
      {reading && <Busy label={t.phone.picture} />}
      {scan?.kind === 'none' && <Notice testID="otp-scan-none" tone="error" message={t.none} />}
      {scan?.kind === 'choose' && (
        <View style={styles.accounts}>
          <Text style={[styles.choose, { color: palette.fgDim }]}>{t.choose}</Text>
          {scan.codes.map(code => (
            <Button
              key={formatOtpUri(code)}
              testID="otp-scan-account"
              variant="secondary"
              label={code.issuer === null ? code.label : `${code.issuer} · ${code.label}`}
              onPress={() => {
                onCode(formatOtpUri(code));
                setScan(null);
              }}
            />
          ))}
        </View>
      )}
      {camera && (
        <QrCamera
          onRead={result => {
            setCamera(false);
            take(result);
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scan: { gap: GAP },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  accounts: { gap: GAP },
  choose: { fontSize: TEXT_SIZE.small },
});
