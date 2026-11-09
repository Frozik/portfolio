import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Temporal } from 'temporal-polyfill';

/** Android's own clock dial, 24-hour or not as the phone is set; `null` when dismissed. */
export function pickTime(initial: Temporal.PlainTime): Promise<Temporal.PlainTime | null> {
  return new Promise(resolve => {
    DateTimePickerAndroid.open({
      mode: 'time',
      // oxlint-disable-next-line no-restricted-globals -- the system dialog takes and gives only Date
      value: new Date(2000, 0, 1, initial.hour, initial.minute),
      onValueChange: (_event, date) =>
        resolve(Temporal.PlainTime.from({ hour: date.getHours(), minute: date.getMinutes() })),
      onDismiss: () => resolve(null),
    });
  });
}
