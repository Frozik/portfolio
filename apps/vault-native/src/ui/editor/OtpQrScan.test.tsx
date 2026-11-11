import { allFields } from '@frozik/vault/model/card';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const BANK_CODE = 'otpauth://totp/Bank:jane?secret=JBSWY3DPEHPK3PXP';

const mockDevice: {
  picture: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> } | null;
  permission: { granted: boolean; canAskAgain: boolean };
} = { picture: null, permission: { granted: true, canAskAgain: true } };

jest.mock('../../device-files/pick-files', () => ({
  pickOneImage: () => Promise.resolve(mockDevice.picture),
}));

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CameraView: (props: object) => <View testID="camera-view" {...props} />,
    useCameraPermissions: () => [mockDevice.permission, jest.fn()],
  };
});

const pictureOf = (text: string) => ({
  name: 'screenshot.png',
  type: 'image/png',
  bytes: new TextEncoder().encode(text),
});

async function editTwoFactorCard() {
  const vault = await unlockedVaultWith([
    aCardWith([aField({ kind: 'login' }, 'jane'), aField({ kind: 'otp' }, '')], { title: 'Bank' }),
  ]);
  await fireEvent.press(screen.getByTestId('card-row'));
  await fireEvent.press(await screen.findByTestId('edit-card'));
  await screen.findByTestId('card-editor');
  return vault;
}

async function savedCode(app: Awaited<ReturnType<typeof unlockedVaultWith>>['app']) {
  await fireEvent.press(screen.getByTestId('editor-save'));
  await screen.findByTestId('card');
  const [card] = app.session?.document.cards.values() ?? [];
  const otp = allFields(card ?? aCardWith([])).find(field => field.spec.kind === 'otp');
  return otp?.value.cardinality === 'single' ? otp.value.value : null;
}

describe('a one-time code from its QR on the phone', () => {
  beforeEach(() => {
    mockDevice.picture = null;
    mockDevice.permission = { granted: true, canAskAgain: true };
  });
  afterEach(() => jest.restoreAllMocks());

  it('fills the field from the camera, passing over a QR without a code', async () => {
    const { app } = await editTwoFactorCard();

    await fireEvent.press(screen.getByTestId('otp-scan-camera'));
    const camera = await screen.findByTestId('camera-view');
    await fireEvent(camera, 'barcodeScanned', { data: 'https://example.com' });
    const strayNoticed = screen.getByTestId('qr-camera-stray');
    await fireEvent(camera, 'barcodeScanned', { data: BANK_CODE });
    await waitFor(() => expect(screen.queryByTestId('qr-camera')).not.toBeOnTheScreen());

    expect(strayNoticed).toBeTruthy();
    expect(await savedCode(app)).toMatch(/^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/);
  });

  it('fills the field from a screenshot, and says when a picture holds no code', async () => {
    const { app } = await editTwoFactorCard();

    mockDevice.picture = pictureOf('https://example.com/holiday');
    await fireEvent.press(screen.getByTestId('otp-scan-picture'));
    const noCode = await screen.findByTestId('otp-scan-none');
    mockDevice.picture = pictureOf(BANK_CODE);
    await fireEvent.press(screen.getByTestId('otp-scan-picture'));
    await waitFor(() => expect(screen.queryByTestId('otp-scan-none')).not.toBeOnTheScreen());

    expect(noCode).toBeTruthy();
    expect(await savedCode(app)).toMatch(/secret=JBSWY3DPEHPK3PXP/);
  });

  it('sends the user to the phone’s settings when the camera was refused for good', async () => {
    mockDevice.permission = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await editTwoFactorCard();

    await fireEvent.press(screen.getByTestId('otp-scan-camera'));
    await fireEvent.press(await screen.findByTestId('qr-camera-settings'));

    expect({
      preview: screen.queryByTestId('camera-view'),
      settings: openSettings.mock.calls.length,
    }).toEqual({ preview: null, settings: 1 });
  });
});
