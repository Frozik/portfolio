import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { isNil } from 'lodash-es';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TOtpScan } from '@frozik/vault-app/document/domain/otp-scan';
import { otpOfQrText } from '@frozik/vault-app/document/domain/otp-scan';

import { Button } from '../kit/Button';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const CLOSE_ICON_SIZE = 26;
const QR_ONLY = { barcodeTypes: ['qr' as const] };

/**
 * The camera over the whole screen until it sees a QR with a one-time code; a QR of anything else
 * is only pointed out, and the camera keeps looking.
 */
export function QrCamera({
  onRead,
  onClose,
}: {
  readonly onRead: (scan: Exclude<TOtpScan, { readonly kind: 'none' }>) => void;
  readonly onClose: () => void;
}) {
  const palette = usePalette();
  const t = useEditorTexts().qr;
  const [permission, requestPermission] = useCameraPermissions();
  const [stray, setStray] = useState(false);
  const [done, setDone] = useState(false);
  const undecided = !isNil(permission) && !permission.granted && permission.canAskAgain;
  useEffect(() => {
    if (undecided) {
      void requestPermission();
    }
  }, [undecided, requestPermission]);
  const seen = ({ data }: BarcodeScanningResult): void => {
    const scan = otpOfQrText(data);
    if (scan.kind === 'none') {
      setStray(true);
      return;
    }
    setDone(true);
    onRead(scan);
  };
  const refused = !isNil(permission) && !permission.granted && !permission.canAskAgain;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View testID="qr-camera" style={[styles.screen, { backgroundColor: palette.bg }]}>
        {permission?.granted === true && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={QR_ONLY}
            onBarcodeScanned={done ? undefined : seen}
          />
        )}
        <View style={styles.bar}>
          <Text style={[styles.aim, { color: palette.fg, backgroundColor: palette.bgElevated }]}>
            {t.phone.aim}
          </Text>
          <Pressable
            testID="qr-camera-close"
            accessibilityRole="button"
            accessibilityLabel={t.phone.close}
            onPress={onClose}
            style={[styles.close, { backgroundColor: palette.bgElevated }]}
          >
            <MaterialIcons name="close" size={CLOSE_ICON_SIZE} color={palette.fg} />
          </Pressable>
        </View>
        {stray && <Notice testID="qr-camera-stray" tone="caution" message={t.none} />}
        {refused && (
          <View style={styles.refused}>
            <Notice testID="qr-camera-refused" tone="error" message={t.phone.noCamera} />
            <Button
              testID="qr-camera-settings"
              variant="secondary"
              icon="settings"
              label={t.phone.openSettings}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: GUTTER, gap: GAP },
  bar: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  aim: { flex: 1, fontSize: TEXT_SIZE.body, padding: GAP, borderRadius: RADIUS },
  close: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refused: { gap: GAP },
});
