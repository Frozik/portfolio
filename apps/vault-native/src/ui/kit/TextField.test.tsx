import { fireEvent, render, screen } from '@testing-library/react-native';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from '../testing/AppUnderTest';
import { TextField } from './TextField';

describe('a secret field', () => {
  it('hides what is typed until asked to show it, and hides it again', async () => {
    await render(
      <AppUnderTest app={aDevice().startStore()}>
        <TextField
          testID="secret"
          label="Master password"
          value="hunter2"
          onChangeText={() => undefined}
          secret
        />
      </AppUnderTest>
    );
    const hidden = screen.getByTestId('secret').props.secureTextEntry;

    await fireEvent.press(screen.getByTestId('secret-reveal'));
    const shown = screen.getByTestId('secret').props.secureTextEntry;
    await fireEvent.press(screen.getByTestId('secret-reveal'));

    expect([hidden, shown, screen.getByTestId('secret').props.secureTextEntry]).toEqual([
      true,
      false,
      true,
    ]);
  });
});
