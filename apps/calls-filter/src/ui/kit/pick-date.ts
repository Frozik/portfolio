import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Temporal } from 'temporal-polyfill';

/** Android's own date dialog; `null` when the user dismisses it. */
export function pickDate(
  initial: Temporal.PlainDate,
  minimum: Temporal.PlainDate
): Promise<Temporal.PlainDate | null> {
  const legacy = (date: Temporal.PlainDate) =>
    // oxlint-disable-next-line no-restricted-globals -- the system dialog takes and gives only Date
    new Date(date.year, date.month - 1, date.day);
  return new Promise(resolve => {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: legacy(initial),
      minimumDate: legacy(minimum),
      onValueChange: (_event, date) =>
        resolve(
          Temporal.PlainDate.from({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
          })
        ),
      onDismiss: () => resolve(null),
    });
  });
}
